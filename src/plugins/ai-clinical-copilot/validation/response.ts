/**
 * Response validation.
 *
 * Nothing reaches the doctor without passing through here. Validation covers
 * both mechanical problems (empty, truncated, wrong shape) and clinical-safety
 * problems (text that reads as an autonomous prescribing or diagnostic
 * decision rather than decision support).
 *
 * A failure is never silently swallowed — the caller surfaces the reason and
 * discards the output.
 */

import type { Capability } from "../capabilities";

export type ValidationFailure = {
  ok: false;
  code:
    | "EMPTY"
    | "TOO_SHORT"
    | "TRUNCATED"
    | "MISSING_SECTIONS"
    | "UNSAFE_CLINICAL_CLAIM";
  message: string;
};

export type ValidationSuccess = {
  ok: true;
  text: string;
  warnings: string[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

/** Sections NOTE_ASSISTANCE must produce for the draft flow to be usable. */
const REQUIRED_NOTE_SECTIONS = ["subjective", "objective", "assessment", "plan"];

/**
 * Phrases indicating the model has stepped outside decision support and is
 * issuing an instruction of its own. Matched case-insensitively on word
 * boundaries. Restatements ("the doctor prescribed", "was started on") do not
 * match, because they are past tense and attributed.
 */
const UNSAFE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bI (?:recommend|advise|suggest|prescribe)\b/i, reason: "AI issued its own clinical recommendation" },
  { pattern: /\byou should (?:start|stop|switch|increase|decrease|discontinue)\b/i, reason: "AI directed a medication change" },
  { pattern: /\b(?:start|stop|discontinue|increase|decrease) (?:the )?(?:patient(?:'s)? )?(?:on )?\d+\s*(?:mg|ml|mcg|g)\b/i, reason: "AI specified a dose change" },
  { pattern: /\bthe diagnosis is\b/i, reason: "AI asserted a diagnosis" },
  { pattern: /\bI diagnose\b/i, reason: "AI asserted a diagnosis" },
  { pattern: /\bdefinitely has\b/i, reason: "AI asserted an unsupported certainty" },
];

/**
 * Weaker signals — surfaced to the doctor as a caution but not grounds for
 * discarding an otherwise valid response.
 */
const WARNING_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(?:likely|probably|presumably) (?:has|indicates|suggests)\b/i, reason: "Contains speculative language — verify against the record." },
  { pattern: /\bconsider (?:starting|prescribing|switching)\b/i, reason: "Suggests a treatment option — confirm before acting." },
];

export type ValidateArgs = {
  text: string;
  capability: Capability;
  /** stop_reason from the provider; "max_tokens" means the output was cut off. */
  stopReason: string | null;
};

export function validateResponse(args: ValidateArgs): ValidationResult {
  const raw = args.text ?? "";
  const text = raw.trim();

  if (!text) {
    return { ok: false, code: "EMPTY", message: "The AI returned an empty response." };
  }

  if (text.length < 20) {
    return {
      ok: false,
      code: "TOO_SHORT",
      message: "The AI response was too short to be usable.",
    };
  }

  if (args.stopReason === "max_tokens") {
    return {
      ok: false,
      code: "TRUNCATED",
      message:
        "The AI response was cut off before completing. Nothing has been saved — try a narrower request.",
    };
  }

  for (const { pattern, reason } of UNSAFE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        code: "UNSAFE_CLINICAL_CLAIM",
        message: `Response withheld: ${reason}. The Copilot provides decision support only.`,
      };
    }
  }

  if (args.capability === "NOTE_ASSISTANCE") {
    const lower = text.toLowerCase();
    const missing = REQUIRED_NOTE_SECTIONS.filter((s) => !lower.includes(s));
    if (missing.length > 0) {
      return {
        ok: false,
        code: "MISSING_SECTIONS",
        message: `The draft note was missing required sections: ${missing.join(", ")}.`,
      };
    }
  }

  const warnings = WARNING_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ reason }) => reason,
  );

  return { ok: true, text, warnings };
}

/**
 * Streaming counterpart. The stream is shown to the doctor as it arrives, so
 * unsafe content cannot be withheld pre-emptively; instead the accumulated
 * text is validated once the stream completes and the client is told to
 * discard what it rendered if validation fails.
 */
export function validateStreamedResponse(args: ValidateArgs): ValidationResult {
  return validateResponse(args);
}
