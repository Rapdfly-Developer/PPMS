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
 *   ← Plugin sends: { type: "PLUGIN_DRAFT_CONFIRMED", pluginId, draft, draftType }
 *   ← Plugin sends: { type: "PLUGIN_ERROR", pluginId, code, message }
 *   ← Plugin sends: { type: "PLUGIN_CLOSE", pluginId }
 *
 * Security:
 *   - postMessage target is the exact plugin origin — never "*"
 *   - Incoming messages validate event.origin before reading payload
 *   - iframe sandbox: allow-scripts allow-same-origin only
 */

import { useEffect, useRef, useState } from "react";

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

  // Send PPMS_INIT once the iframe signals it has loaded
  useEffect(() => {
    if (!loaded) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage(
      {
        type: "PPMS_INIT",
        version: "1",
        pluginId,
        token,
        patientRef,
        visitId,
        ppmsVersion: "16.2.9",
      },
      pluginOrigin,
    );
  }, [loaded, token, patientRef, visitId, pluginId, pluginOrigin]);

  // Listen for plugin messages — PLUGIN_DRAFT_CONFIRMED surfaces the draft for doctor review
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Exact origin validation — never trust event.origin loosely
      if (event.origin !== pluginOrigin) return;
      if (!event.data || typeof event.data !== "object") return;

      const { type } = event.data;

      // Generic draft-confirmed event (all plugins)
      if (type === "PLUGIN_DRAFT_CONFIRMED") {
        if (process.env.NODE_ENV === "development") {
          console.log(`[ExternalPluginSlot:${pluginId}] Draft confirmed (doctor review pending).`);
        }
        return;
      }

      // Backward-compat shim: the AI Clinical Copilot project sends this until updated
      if (type === "COPILOT_DRAFT_CONFIRMED") {
        if (process.env.NODE_ENV === "development") {
          console.log(`[ExternalPluginSlot:${pluginId}] Draft confirmed via legacy event (doctor review pending).`);
        }
        return;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pluginOrigin, pluginId]);

  if (!pluginOrigin) return null;

  return (
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
        style={{ width: "100%", height: "480px", border: "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError("load-error")}
      />
    </div>
  );
}
