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
import { setDdx, cacheDdx, readCachedDdx, getDdx } from "./ddx-store";

/* Defensive caps. The payload crosses an origin boundary, so it is treated as
   untrusted input and clamped before it reaches React — the same posture the
   ai-draft route takes with draftText. */
const MAX_DX = 12;
const MAX_LEN = 300;

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

  /* Display fallback so the cards do not spin forever — see DDX_TIMEOUT_MS. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (getDdx(visitId)?.status === "loading") setDdx(visitId, { status: "timeout" });
    }, DDX_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [visitId]);

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
