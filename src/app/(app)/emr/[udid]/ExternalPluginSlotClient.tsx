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
 *
 * Security:
 *   - postMessage target is the exact plugin origin — never "*"
 *   - Incoming messages validate event.origin before reading payload
 *   - iframe sandbox: allow-scripts allow-same-origin only
 *   - doctorId/tenantId NEVER accepted from the Copilot — derived from session server-side
 */

import { useEffect, useRef, useState, useCallback } from "react";

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
        style={{ width: "100%", height: "520px", border: "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError("load-error")}
      />
    </div>
  );
}
