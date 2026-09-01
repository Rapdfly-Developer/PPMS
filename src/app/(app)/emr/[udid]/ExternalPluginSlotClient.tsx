"use client";

/**
 * ExternalPluginSlotClient
 *
 * Renders the iframe and delivers the plugin token via postMessage.
 * Token is NEVER placed in the iframe src= URL.
 *
 * Message protocol:
 *   → PPMS sends: { type: "PPMS_INIT", token: "...", patientRef: "...", visitId: "..." }
 *   ← Copilot sends: { type: "COPILOT_DRAFT_CONFIRMED", draft: "..." }
 *
 * Security:
 *   - postMessage uses exact origin — never "*"
 *   - Incoming messages validate origin before reading payload
 *   - iframe has sandbox="allow-scripts allow-same-origin" only
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  copilotOrigin: string;
  token: string;
  patientRef: string;
  visitId: string;
  pluginId: string;
};

export function ExternalPluginSlotClient({
  copilotOrigin,
  token,
  patientRef,
  visitId,
  pluginId,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send PPMS_INIT once the iframe signals it is ready
  useEffect(() => {
    if (!loaded) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage(
      { type: "PPMS_INIT", token, patientRef, visitId, pluginId },
      copilotOrigin,
    );
  }, [loaded, token, patientRef, visitId, pluginId, copilotOrigin]);

  // Listen for COPILOT_DRAFT_CONFIRMED (future: surface to doctor UI)
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Exact origin validation — never trust event.origin loosely
      if (event.origin !== copilotOrigin) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "COPILOT_DRAFT_CONFIRMED") return;

      // Future: pass draft up to a review flow (not auto-saved)
      // For now we log in dev only — no clinical data reaches the console in prod
      if (process.env.NODE_ENV === "development") {
        console.log("[ExternalPluginSlot] Draft confirmed by Copilot (doctor review pending).");
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [copilotOrigin]);

  if (!copilotOrigin) return null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] overflow-hidden no-print">
      {error && (
        <div className="px-4 py-2 text-sm text-amber-700 bg-amber-50">
          AI Copilot could not load. Please refresh the page.
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={copilotOrigin}
        sandbox="allow-scripts allow-same-origin"
        title="AI Clinical Copilot"
        style={{ width: "100%", height: "480px", border: "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError("load-error")}
      />
    </div>
  );
}
