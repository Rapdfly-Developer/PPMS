"use client";

/**
 * ExternalPluginSlotClient
 *
 * Renders the iframe for any externally-deployed plugin and delivers the plugin
 * token via postMessage. Token is NEVER placed in the iframe src= URL.
 *
 * Generic postMessage protocol (v1):
 *   → PPMS sends:   { type: "PPMS_INIT", version: "1", pluginId, token, patientRef, visitId, ppmsVersion }
 *   ← Plugin sends: { type: "PLUGIN_READY", pluginId }
 *   ← Plugin sends: { type: "PLUGIN_ERROR", pluginId, code, message }
 *   ← Plugin sends: { type: "PLUGIN_CLOSE", pluginId }
 *   ← Plugin sends: { type: "PLUGIN_DIFFERENTIAL_UPDATE", pluginId, visitId,
 *                      items: [{ name, confidence: "Low"|"Moderate", source? }] }
 *                    Contract owned by ppms-copilot:
 *                      src/lib/constants.ts     MSG_PLUGIN_DIFFERENTIAL_UPDATE
 *                      src/postmessage/types.ts PluginDifferentialUpdateMessage
 *                    Sent once per successful consolidated generation, and again
 *                    after Regenerate. NOT sent when the differential section
 *                    fails validation — so "no message" is a real outcome the
 *                    receiver must handle, not just slowness.
 *                    An empty `items` array is meaningful: "considered, nothing
 *                    to show" (e.g. insufficient evidence).
 *
 * Security:
 *   - postMessage target is the exact plugin origin — never "*"
 *   - Incoming messages validate event.origin before reading payload
 *   - iframe sandbox: allow-scripts allow-same-origin only
 *   - doctorId/tenantId NEVER accepted from the Copilot — derived from session server-side
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { DdxState, DifferentialDx } from "./DifferentialDiagnosisCard";
import type { GuidanceState, ExamGuidanceItem } from "./ExamGuidanceCard";
import {
  setDdx, cacheDdx, readCachedDdx, getDdx,
  seedGuidance, settleGuidance, cacheGuidance, readCachedGuidance,
  subscribeGuidanceRequests, isGuidanceInFlight,
} from "./copilot-store";

/* Defensive caps. The payload crosses an origin boundary, so it is treated as
   untrusted input and clamped before it reaches React — the same posture the
   ai-draft route takes with draftText. */
const MAX_DX = 12;
const MAX_LEN = 300;
/* Guidance is grouped into two segments and read at a glance, so it is capped
   tighter than the differential: more than a handful of rows per segment stops
   being scannable and starts being a wall. */
const MAX_GUIDANCE = 8;

/* Exam guidance is user-initiated, so the ceiling is a stuck-request guard
   rather than the differential's "is it still coming?" display fallback. It is
   longer because the doctor asked and is waiting, and shorter than infinity
   because a spinner that never resolves is worse than an error with a retry. */
const GUIDANCE_TIMEOUT_MS = 120_000;

/*
 * How long to spin before saying the differential could not be generated.
 *
 * Sized against the plugin's own worst case rather than a guess. ppms-copilot
 * allows AI_REQUEST_TIMEOUT_MS per request (default 60s) and retries a
 * rate-limited call twice with 3s/6s backoff, so a pathological run can reach
 * ~3 minutes. Anything in the 30-45s range would therefore report failure while
 * a perfectly healthy call is still in flight.
 *
 * 90s covers the common worst case — one request hitting its full 60s timeout,
 * plus iframe load and generation overhead — without leaving a spinner up for
 * three minutes in the rare retry storm.
 *
 * This is a DISPLAY fallback, not a cancellation: nothing is aborted, and a
 * message arriving after the deadline still replaces the state. Firing early is
 * therefore self-correcting, which is why the bias is toward the shorter end.
 */
const DDX_TIMEOUT_MS = 90_000;

const clean = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, MAX_LEN);
  return t.length > 0 ? t : undefined;
};

function cachedToState(raw: string | null): DdxState {
  if (!raw) return { status: "loading" };
  try {
    const parsed = parseDiagnoses(JSON.parse(raw));
    if (!parsed) return { status: "loading" };
    return parsed.length > 0 ? { status: "ready", items: parsed } : { status: "none" };
  } catch {
    return { status: "loading" };
  }
}

/* Idle, not loading, when there is no cache: nothing has been asked for yet. */
function cachedGuidanceToState(raw: string | null): GuidanceState {
  if (!raw) return { status: "idle" };
  try {
    const parsed = parseGuidance(JSON.parse(raw));
    if (!parsed) return { status: "idle" };
    return parsed.length > 0 ? { status: "ready", items: parsed } : { status: "insufficient" };
  } catch {
    return { status: "idle" };
  }
}

/**
 * Returns the parsed list, or null when the payload is not a usable shape.
 *
 * Field names and segment literals mirror ppms-copilot's ExamGuidanceSection
 * verbatim ("Anterior Segment" / "Posterior Segment", with that exact casing
 * and spacing). An unrecognised segment still drops the row rather than
 * defaulting it -- filing a posterior finding under the anterior heading is
 * worse than omitting it -- so these strings have to stay in step with the
 * plugin. Bending them to a local house style silently empties the card.
 */
function parseGuidance(raw: unknown): ExamGuidanceItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ExamGuidanceItem[] = [];
  for (const item of raw.slice(0, MAX_GUIDANCE)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const segment =
      o.segment === "Anterior Segment" || o.segment === "Posterior Segment" ? o.segment : null;
    const documented = clean(o.documented);
    if (!segment || !documented) continue;
    out.push({
      segment,
      documented,
      // A single prose string on the wire, not a list.
      associatedFindingsNotDocumented: clean(o.associatedFindingsNotDocumented) ?? "",
    });
  }
  return out;
}

/** Returns the parsed list, or null when the payload is not a usable shape. */
function parseDiagnoses(raw: unknown): DifferentialDx[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DifferentialDx[] = [];
  for (const item of raw.slice(0, MAX_DX)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = clean(o.name);
    if (!name) continue;   // a suggestion with no name is not renderable
    out.push({ name, confidence: clean(o.confidence), source: clean(o.source) });
  }
  return out;
}

type Props = {
  pluginOrigin: string;
  pluginName: string;
  token: string;
  patientRef: string;
  visitId: string;
  pluginId: string;
};

export function ExternalPluginSlotClient({
  pluginOrigin,
  pluginName,
  token,
  patientRef,
  visitId,
  pluginId,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /* Pending exam-guidance timeout, so settling can cancel it. */
  const guidanceTimer = useRef<number | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Seed the shared store. Doing this on mount is also what tells the per-tab
     cards that the Copilot is active at all: this component only renders once
     ExternalPluginSlot has passed all five gating checks, so a disabled or
     unlicensed plugin leaves the store empty and no card appears anywhere.

     Seeds from sessionStorage when this visit was already analysed in this tab,
     so a remount does not drop the cards back to "loading". */
  useEffect(() => {
    if (getDdx(visitId)) return;   // already seeded this session
    setDdx(visitId, cachedToState(readCachedDdx(visitId)));
  }, [visitId]);

  /* Seeding is what tells the per-tab cards the Copilot is active at all — the
     same gating inheritance the differential relies on. Restores a previously
     generated result for this visit so switching tabs does not reset to idle. */
  useEffect(() => {
    seedGuidance(visitId, cachedGuidanceToState(readCachedGuidance(visitId)));
  }, [visitId]);

  /* Display fallback so the cards do not spin forever — see DDX_TIMEOUT_MS. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (getDdx(visitId)?.status === "loading") setDdx(visitId, { status: "timeout" });
    }, DDX_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [visitId]);

  /* Exam guidance trigger. Subscribed here because this component owns the
     iframe handle and the pluginId/patientRef the mint endpoint requires. */
  useEffect(() => {
    const clearGuidanceTimer = () => {
      if (guidanceTimer.current !== undefined) {
        window.clearTimeout(guidanceTimer.current);
        guidanceTimer.current = undefined;
      }
    };

    return subscribeGuidanceRequests((reqVisitId) => {
      if (reqVisitId !== visitId) return;

      const fail = (message: string) => {
        clearGuidanceTimer();
        settleGuidance(visitId, { status: "error", message });
      };

      /* The token prop was signed when the page rendered, against a 600s hard
         ceiling in signPluginToken. An on-demand click is routinely later than
         that, so mint a fresh one per trigger rather than send a dead token.
         The endpoint re-runs every authorisation check server-side and derives
         dataScopes from the manifest, so this widens nothing. */
      void (async () => {
        let fresh: string;
        try {
          const res = await fetch("/api/v1/plugin-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ pluginId, patientRef, visitId }),
          });
          if (!res.ok) {
            fail(
              res.status === 401 || res.status === 403
                ? "Your session no longer permits this. Refresh the page and try again."
                : "Could not authorise the request. Please try again.",
            );
            return;
          }
          const data = (await res.json()) as { token?: unknown };
          if (typeof data.token !== "string" || !data.token) {
            fail("Could not authorise the request. Please try again.");
            return;
          }
          fresh = data.token;
        } catch {
          fail("Network error. Please try again.");
          return;
        }

        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) {
          fail("The assistant is not ready yet. Please try again in a moment.");
          return;
        }

        // Exact origin, never "*" — same invariant as PPMS_INIT.
        iframe.contentWindow.postMessage(
          {
            type: "PPMS_REQUEST_EXAM_GUIDANCE",
            version: "1",
            pluginId,
            visitId,
            token: fresh,
          },
          pluginOrigin,
        );

        /* Tracked so settling can clear it. Without that, this request's
           timeout could still be pending when the doctor triggers a second one
           and would fail the newer call -- the job a wire-level request id
           would otherwise do, and this protocol has none. */
        guidanceTimer.current = window.setTimeout(() => {
          if (isGuidanceInFlight(visitId)) fail("The assistant did not respond in time.");
        }, GUIDANCE_TIMEOUT_MS);
      })();
    });
  }, [visitId, pluginId, patientRef, pluginOrigin]);

  const sendInit = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "PPMS_INIT", version: "1", pluginId, token, patientRef, visitId, ppmsVersion: "16.2.9" },
      pluginOrigin,
    );
  }, [pluginId, token, patientRef, visitId, pluginOrigin]);

  // Send PPMS_INIT once the iframe's HTML has loaded (may race with React hydration)
  useEffect(() => {
    if (!loaded) return;
    sendInit();
  }, [loaded, sendInit]);

  // Re-send PPMS_INIT once when Copilot signals its message listener is ready
  // (PLUGIN_MOUNTED). Respond only to the FIRST PLUGIN_MOUNTED per mount — after
  // that the Copilot has its session and further sends must not re-trigger auto-start.
  useEffect(() => {
    let responded = false;
    function onMounted(event: MessageEvent) {
      if (event.origin !== pluginOrigin) return;
      const msg = event.data as Record<string, unknown>;
      if (msg?.type === "PLUGIN_MOUNTED" && msg?.pluginId === pluginId) {
        if (responded) return;
        responded = true;
        sendInit();
      }
    }
    window.addEventListener("message", onMounted);
    return () => window.removeEventListener("message", onMounted);
  }, [pluginOrigin, pluginId, sendInit]);

  // Listen for plugin messages
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== pluginOrigin) return;
      if (!event.data || typeof event.data !== "object") return;

      const msg = event.data as Record<string, unknown>;
      const { type } = msg;

      if (type === "PLUGIN_READY") return;

      if (type === "PLUGIN_ERROR") {
        if (process.env.NODE_ENV === "development") {
          console.error(`[ExternalPluginSlot:${pluginId}] Plugin error:`, msg.code, msg.message);
        }
        return;
      }

      if (type === "PLUGIN_DIFFERENTIAL_UPDATE") {
        // origin was checked above; also require the message to be from THIS
        // plugin and about THIS visit, so a stale frame from a previously
        // opened visit cannot overwrite the current one.
        if (msg.pluginId !== pluginId) return;
        if (msg.visitId !== visitId) return;

        const items = parseDiagnoses(msg.items);
        if (!items) return;   // unusable shape: keep showing whatever we have

        setDdx(visitId, items.length > 0 ? { status: "ready", items } : { status: "none" });
        cacheDdx(visitId, items);
        return;
      }

      if (type === "PLUGIN_EXAM_GUIDANCE_RESULT") {
        // Origin was checked above. Same plugin, same visit -- and settleGuidance
        // ignores anything we did not ask for, so an unsolicited result cannot
        // write into the card. There is no request id on this wire; only one
        // call per visit can be outstanding, which is what makes visitId enough.
        if (msg.pluginId !== pluginId) return;
        if (msg.visitId !== visitId) return;

        // Discriminated envelope: ok:true carries sections, ok:false an error.
        if (msg.ok === false) {
          // Plugin-supplied text crossing an origin boundary -- clamped like
          // any other untrusted string before it reaches the doctor's screen.
          const detail = clean(msg.errorMessage);
          settleGuidance(visitId, {
            status: "error",
            message: detail ?? "The assistant could not generate guidance for this visit.",
          });
          return;
        }

        const items = msg.ok === true ? parseGuidance(msg.sections) : null;
        if (!items) {
          settleGuidance(visitId, {
            status: "error",
            message: "The assistant returned an unreadable response.",
          });
          return;
        }

        settleGuidance(
          visitId,
          items.length > 0 ? { status: "ready", items } : { status: "insufficient" },
        );
        cacheGuidance(visitId, items);
        return;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pluginOrigin, pluginId, visitId]);

  if (!pluginOrigin) return null;

  return (
    /* The iframe now lives here, below the tab strip, instead of inside the
       Copilot tab's content. <Tabs> renders only the active tab and unmounts
       the rest, so hosting it there meant the consolidated analysis call only
       fired if a doctor happened to open that tab, and the listener died the
       moment they left it. Mounted here it loads once when the visit opens and
       stays for the life of the EMR page. */
    <div className="mt-4 rounded-xl border border-[var(--color-border)] overflow-hidden no-print">
      {error && (
        <div className="px-4 py-2 text-sm text-amber-700 bg-amber-50">
          {pluginName} could not load. Please refresh the page.
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={pluginOrigin}
        sandbox="allow-scripts allow-same-origin"
        title={pluginName}
        style={{ width: "100%", height: "520px", border: "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError("load-error")}
      />
    </div>
  );
}
