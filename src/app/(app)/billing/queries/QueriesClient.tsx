"use client";

import { useState, useTransition } from "react";
import { MessageSquareWarning, X, Send } from "lucide-react";
import { respondToQuery, closeQuery } from "../actions";

type QueryItem = {
  id: string; claimId: string; claimNumber: string; claimStatus: string;
  patientName: string; insuranceCompanyName: string;
  queryBy: string; queryText: string; responseText: string | null;
  status: string; raisedAt: string; respondedAt: string | null;
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

const STATUS_COLORS: Record<string, string> = {
  OPEN:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  RESPONDED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CLOSED:    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export function QueriesClient({ queries }: { queries: QueryItem[] }) {
  const [, start] = useTransition();
  const [filter, setFilter] = useState("OPEN");
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const filtered = filter === "ALL" ? queries : queries.filter((q) => q.status === filter);

  function handleRespond(id: string) {
    if (!responseText.trim()) return;
    start(() => respondToQuery(id, responseText).then(() => { setResponding(null); setResponseText(""); }));
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Insurance Queries</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Track and respond to insurer queries across all claims.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["ALL", "OPEN", "RESPONDED", "CLOSED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s ? "bg-teal-500 text-white" : "bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"}`}>
            {s === "ALL" ? `All (${queries.length})` : `${s} (${queries.filter((q) => q.status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-dashed border-[var(--color-border)]">
          <MessageSquareWarning size={40} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-500)]">No queries in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <div key={q.id} className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)" }}>
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-teal-500">{q.claimNumber}</span>
                      <span className="text-xs text-[var(--color-ink-400)]">·</span>
                      <span className="text-xs text-[var(--color-ink-600)]">{q.patientName}</span>
                      <span className="text-xs text-[var(--color-ink-400)]">·</span>
                      <span className="text-xs text-[var(--color-ink-500)]">{q.insuranceCompanyName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status]}`}>{q.status}</span>
                    </div>
                    <p className="text-sm text-[var(--color-ink-800)] font-medium">{q.queryText}</p>
                    <p className="text-xs text-[var(--color-ink-400)] mt-1">
                      By {q.queryBy} · {fmtDate(q.raisedAt)}
                    </p>
                  </div>
                </div>

                {q.responseText && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-ink-400)] mb-1">Response:</p>
                    <p className="text-sm text-emerald-600">{q.responseText}</p>
                    {q.respondedAt && <p className="text-xs text-[var(--color-ink-400)] mt-1">{fmtDate(q.respondedAt)}</p>}
                  </div>
                )}

                {q.status === "OPEN" && (
                  responding === q.id ? (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
                      <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={2}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none"
                        placeholder="Type your response to the insurer…" />
                      <div className="flex gap-2">
                        <button onClick={() => { setResponding(null); setResponseText(""); }} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)]"><X size={11} /> Cancel</button>
                        <button onClick={() => handleRespond(q.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg font-semibold text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}><Send size={11} /> Send</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex gap-2">
                      <button onClick={() => setResponding(q.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-teal-600 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30">
                        <Send size={11} /> Respond
                      </button>
                      <button onClick={() => start(() => closeQuery(q.id).then())} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]">
                        Close Query
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
