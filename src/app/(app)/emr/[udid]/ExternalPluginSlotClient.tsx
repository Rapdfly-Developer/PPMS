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
 *   ← Plugin sends: { type: "PLUGIN_DRAFT_CONFIRMED", pluginId, draftType, draftText, visitId }
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

type PendingDraft = {
  draftType: "consultation_note" | "follow_up_summary";
  draftText: string;
  visitId: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

/** Strip common markdown syntax so drafts render as clean plain text in the textarea. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold**
    .replace(/\*(.+?)\*/g, "$1")        // *italic*
    .replace(/^#{1,6}\s+/gm, "")        // # headings
    .replace(/^[-*]{3,}\s*$/gm, "---")  // *** or --- separators → plain ---
    .replace(/`(.+?)`/g, "$1")          // `code`
    .replace(/_{2}(.+?)_{2}/g, "$1")    // __bold__
    .replace(/_(.+?)_/g, "$1");         // _italic_
}

const DRAFT_TYPE_LABELS: Record<string, string> = {
  consultation_note: "Consultation Note",
  follow_up_summary: "Follow-up Summary",
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
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [editedDraftText, setEditedDraftText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

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
      // Exact origin validation — never trust event.origin loosely
      if (event.origin !== pluginOrigin) return;
      if (!event.data || typeof event.data !== "object") return;

      const msg = event.data as Record<string, unknown>;
      const { type } = msg;

      if (type === "PLUGIN_READY") return;

      if (type === "PLUGIN_DRAFT_CONFIRMED" || type === "COPILOT_DRAFT_CONFIRMED") {
        const rawDraftType = msg.draftType as string;
        const rawDraftText = (msg.draftText ?? msg.draft) as string;
        const rawVisitId = (msg.visitId ?? visitId) as string;

        if (
          (rawDraftType !== "consultation_note" && rawDraftType !== "follow_up_summary") ||
          typeof rawDraftText !== "string" ||
          !rawDraftText.trim()
        ) {
          return;
        }

        const cleanText = stripMarkdown(rawDraftText.trim());
        setPendingDraft({
          draftType: rawDraftType,
          draftText: cleanText,
          visitId: rawVisitId,
        });
        setEditedDraftText(cleanText);
        setSaveState("idle");
        return;
      }

      if (type === "PLUGIN_ERROR") {
        if (process.env.NODE_ENV === "development") {
          console.error(`[ExternalPluginSlot:${pluginId}] Plugin error:`, msg.code, msg.message);
        }
        return;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pluginOrigin, pluginId, visitId]);

  const saveDraft = useCallback(async () => {
    if (!pendingDraft || !editedDraftText.trim()) return;
    setSaveState("saving");

    try {
      const res = await fetch(`/api/visits/${encodeURIComponent(pendingDraft.visitId)}/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftType: pendingDraft.draftType,
          draftText: editedDraftText.trim(),
        }),
      });

      if (res.ok) {
        setSaveState("saved");
        // Dismiss panel after short delay
        setTimeout(() => {
          setPendingDraft(null);
          setSaveState("idle");
        }, 2500);
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    }
  }, [pendingDraft, editedDraftText]);

  if (!pluginOrigin) return null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] overflow-hidden no-print">
      {error && (
        <div className="px-4 py-2 text-sm text-amber-700 bg-amber-50">
          {pluginName} could not load. Please refresh the page.
        </div>
      )}

      {/* Draft review panel — shown when Copilot sends PLUGIN_DRAFT_CONFIRMED */}
      {pendingDraft && (
        <div className="border-b border-[var(--color-border)] bg-teal-50 dark:bg-teal-950/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                AI Draft — {DRAFT_TYPE_LABELS[pendingDraft.draftType] ?? pendingDraft.draftType}
              </span>
              <p className="text-xs text-teal-600 dark:text-teal-500 mt-0.5">
                Review and edit before saving. This draft was generated by AI for your review.
              </p>
            </div>
            <button
              onClick={() => { setPendingDraft(null); setSaveState("idle"); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-4 shrink-0"
              aria-label="Dismiss draft"
            >
              ✕ Dismiss
            </button>
          </div>

          <textarea
            value={editedDraftText}
            onChange={e => setEditedDraftText(e.target.value)}
            rows={8}
            disabled={saveState === "saving" || saveState === "saved"}
            className="w-full text-sm font-mono rounded border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 p-2 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y disabled:opacity-60"
            aria-label="AI-generated draft text — edit before saving"
          />

          <div className="flex items-center gap-3 mt-3">
            {saveState !== "saved" && (
              <button
                onClick={saveDraft}
                disabled={saveState === "saving" || !editedDraftText.trim()}
                className="px-4 py-1.5 text-sm font-medium rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saveState === "saving" ? "Saving…" : "Save to EMR"}
              </button>
            )}
            {saveState === "saved" && (
              <span className="text-sm text-teal-700 dark:text-teal-400 font-medium">
                ✓ Draft saved to visit record
              </span>
            )}
            {saveState === "error" && (
              <span className="text-sm text-red-600 dark:text-red-400">
                Save failed — please try again or copy the text manually.
              </span>
            )}
            {saveState !== "saving" && saveState !== "saved" && (
              <button
                onClick={() => { setPendingDraft(null); setSaveState("idle"); }}
                className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            )}
          </div>
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
