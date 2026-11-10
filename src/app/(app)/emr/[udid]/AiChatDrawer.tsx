"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, ArrowUp, Trash2, ShieldAlert, Maximize2, Minimize2 } from "lucide-react";
import { AiDisclaimer } from "@/components/ui/AiDisclaimer";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

const MAX_INPUT_HEIGHT = 104;

/** Minimal markdown: headings, bullets and **bold**. */
function RichText({ text }: { text: string }) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
  return (
    <div className="space-y-1 [overflow-wrap:anywhere]">
      {text.split("\n").map((raw, i) => {
        const heading = /^\s{0,3}#{1,6}\s+(.+)$/.exec(raw);
        if (heading) {
          return <p key={i} className="font-semibold text-[var(--color-primary-800)] pt-1">{bold(heading[1])}</p>;
        }
        const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/.exec(raw);
        if (bullet) {
          return (
            <p key={i} className="flex gap-2 pl-0.5">
              <span aria-hidden="true" className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-[var(--color-primary-400)]" />
              <span>{bold(bullet[1])}</span>
            </p>
          );
        }
        if (!raw.trim()) return <div key={i} className="h-0.5" />;
        return <p key={i} className="whitespace-pre-wrap">{bold(raw)}</p>;
      })}
    </div>
  );
}

/** The assistant's little face: a sparkle on a teal disc. */
function BotAvatar() {
  return (
    <span
      aria-hidden="true"
      className={`h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-full text-white`}
      style={{
        background: "linear-gradient(135deg, var(--color-primary-400) 0%, var(--color-primary-600) 100%)",
        boxShadow: "0 2px 8px rgba(13,148,136,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      <Sparkles size={11} />
    </span>
  );
}

function TypingDots() {
  return (
    <span role="status" aria-label="Thinking" className="flex items-center gap-1 py-1.5 px-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-400)] animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

/** A fresh hello each time, tuned to the time of day. */
function pickGreeting(name: string): string {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const options = [
    `${hello}, ${name}! 👋 How can I help you today?`,
    `${hello}, ${name}! I have this patient's record within reach. What would you like to know?`,
    `Hi ${name}! ✨ Ask me about this patient, a drug dose or a tricky differential.`,
    `${hello}, ${name}! Ready when you are. What are we looking into today?`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

export function AiChatDrawer({
  visitId,
  greetingName,
  onClose,
}: {
  visitId: string;
  greetingName: string;
  onClose: () => void;
}) {
  const greetedKey = `ai-chat-greeted-${visitId}`;
  const [greeting] = useState(() => pickGreeting(greetingName));
  // True the first time the chat is opened for this visit in this browser tab
  const [firstOpenThisVisit] = useState(() => {
    try {
      return !sessionStorage.getItem(greetedKey);
    } catch {
      return true;
    }
  });
  // How many messages came from the saved history, so the greeting sits after them
  const [historyCount, setHistoryCount] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Saved conversation for this user and patient
  useEffect(() => {
    let alive = true;
    fetch(`/api/assistant/chat?visitId=${encodeURIComponent(visitId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && Array.isArray(data?.messages)) {
          setMessages(data.messages);
          setHistoryCount(data.messages.length);
        }
        else setError(data?.error ?? "Could not load the earlier chat.");
      })
      .catch(() => {
        if (alive) setError("Could not load the earlier chat.");
      })
      .finally(() => {
        if (alive) setLoadingHistory(false);
      });
    return () => {
      alive = false;
    };
  }, [visitId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(greetedKey, "1");
    } catch {
      // Storage can be blocked; the greeting then simply shows again
    }
  }, [greetedKey]);

  // Focus the input on open; return focus to the caller on close
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      returnTo?.focus();
    };
  }, []);

  // Escape closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // The page behind must not scroll while the chat fills the screen
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Keep the newest message in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loadingHistory, fullscreen]);

  // The input grows with its text, up to a few lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [input]);

  async function clearChat() {
    if (sending || clearing) return;
    setError(null);
    setClearing(true);
    try {
      const res = await fetch(`/api/assistant/chat?visitId=${encodeURIComponent(visitId)}`, { method: "DELETE" });
      if (res.ok) {
        setMessages([]);
        setHistoryCount(0);
      }
      else setError("Could not clear the chat. Please try again.");
    } catch {
      setError("Could not clear the chat. Please try again.");
    } finally {
      setClearing(false);
      inputRef.current?.focus();
    }
  }

  async function send() {
    const question = input.trim();
    if (!question || sending) return;
    setError(null);
    setSending(true);
    setInput("");

    const stamp = Date.now();
    const userId = `local-user-${stamp}`;
    const answerId = `local-answer-${stamp}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: question },
      { id: answerId, role: "assistant", content: "" },
    ]);

    // A failed question is not saved, so take it back out and restore the input.
    const undo = (message: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== userId && m.id !== answerId));
      setInput(question);
      setError(message);
    };

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, message: question }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        undo(data?.error ?? "The AI could not answer. Please try again.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (!text) continue;
        setMessages((prev) =>
          prev.map((m) => (m.id === answerId ? { ...m, content: m.content + text } : m)),
        );
      }
    } catch {
      undo("The connection dropped. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const canSend = !sending && !!input.trim();
  const showGreeting = firstOpenThisVisit || historyCount === 0;
  // Fullscreen keeps the conversation in a readable centre column
  const gutter = fullscreen ? "px-[max(0.75rem,calc(50%-24rem))]" : "px-3";

  const bubble = (m: ChatMsg) =>
    m.role === "user" ? (
      <div key={m.id} className="flex justify-end">
        <div
          className="max-w-[82%] rounded-2xl rounded-br-md px-3 py-1.5 text-label leading-relaxed text-white whitespace-pre-wrap [overflow-wrap:anywhere]"
          style={{
            background: "linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%)",
            boxShadow: "0 2px 6px rgba(13,148,136,0.25)",
          }}
        >
          {m.content}
        </div>
      </div>
    ) : (
      <div key={m.id} className="flex items-end gap-1.5">
        <BotAvatar />
        <div
          className="max-w-[86%] rounded-2xl rounded-bl-md bg-white px-3 py-1.5 text-label leading-relaxed text-[var(--color-ink-800)] border border-[var(--color-primary-100)]"
          style={{ boxShadow: "0 1px 3px rgba(17,24,39,0.05)" }}
        >
          {m.content ? <RichText text={m.content} /> : <TypingDots />}
        </div>
      </div>
    );

  return (
    <motion.div
      role="dialog"
      aria-label="AI Chat"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`no-print fixed z-50 flex flex-col overflow-hidden bg-white ${
        fullscreen
          ? "inset-0"
          : "right-3 sm:right-6 bottom-[4.75rem] w-[calc(100vw-1.5rem)] sm:w-[23.5rem] rounded-3xl"
      }`}
      style={{
        height: fullscreen ? "100dvh" : "min(34rem, calc(100dvh - 6.5rem))",
        transformOrigin: "bottom right",
        boxShadow: fullscreen
          ? "none"
          : "0 24px 60px -12px rgba(15,118,110,0.35), 0 8px 20px -8px rgba(17,24,39,0.18), 0 0 0 1px rgba(15,118,110,0.12)",
      }}
    >
      {/* Header */}
      <div
        className={`relative shrink-0 flex items-center gap-2.5 py-3 text-white ${fullscreen ? "px-5" : "px-3.5"}`}
        style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)" }}
      >
        <span className="relative shrink-0">
          <span
            aria-hidden="true"
            className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white text-[var(--color-primary-600)]"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
          >
            <Sparkles size={16} />
          </span>
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[var(--color-primary-700)]"
          />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="text-sm font-bold tracking-tight">AI Chat</h2>
          <p className="text-micro text-white/70">Guidance only</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            disabled={sending || clearing}
            className="shrink-0 flex items-center gap-1 text-micro font-semibold pl-2 pr-2.5 py-1 rounded-full bg-white/12 text-white/90 border border-white/20 hover:bg-white/22 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Trash2 size={11} />
            Clear
          </button>
        )}
        <button
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all"
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          onClick={onClose}
          aria-label="Close AI Chat"
          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all"
        >
          <X size={15} />
        </button>
      </div>

      {/* Conversation */}
      <div
        ref={listRef}
        aria-live="polite"
        className={`scrollbar-thin flex-1 overflow-y-auto py-3 space-y-2.5 ${gutter}`}
        style={{ background: "linear-gradient(180deg, var(--color-primary-50) 0%, #FFFFFF 38%)" }}
      >
        {loadingHistory ? (
          <div className="flex items-end gap-1.5">
            <BotAvatar />
            <div className="rounded-2xl rounded-bl-md bg-white px-3 border border-[var(--color-primary-100)]">
              <TypingDots />
            </div>
          </div>
        ) : (
          <>
            {messages.slice(0, historyCount).map(bubble)}
            {showGreeting && bubble({ id: "greeting", role: "assistant", content: greeting })}
            {messages.slice(historyCount).map(bubble)}
          </>
        )}
      </div>

      {/* Composer */}
      <div className={`shrink-0 pt-2 pb-2.5 bg-white border-t border-[var(--color-primary-100)] ${gutter}`}>
        {error && (
          <p role="alert" className="mb-1.5 px-1 text-micro text-rose-600">
            {error}
          </p>
        )}
        <div className="flex items-end gap-1.5 rounded-[1.4rem] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] pl-3.5 pr-1.5 py-1.5 transition-colors focus-within:border-[var(--color-primary-400)] focus-within:bg-white">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask anything…"
            aria-label="Your question"
            className="flex-1 resize-none bg-transparent py-1 text-label leading-snug text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!canSend}
            aria-label="Send"
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-full text-white transition-all active:scale-90 disabled:cursor-not-allowed"
            style={{
              background: canSend
                ? "linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%)"
                : "var(--color-ink-300)",
              boxShadow: canSend ? "0 2px 6px rgba(13,148,136,0.35)" : "none",
            }}
          >
            <ArrowUp size={15} strokeWidth={2.5} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowDisclaimer((v) => !v)}
          aria-expanded={showDisclaimer}
          className="mt-1.5 w-full flex items-center justify-center gap-1 text-[10px] text-[var(--color-ink-400)] hover:text-[var(--color-ink-500)] transition-colors"
        >
          <ShieldAlert size={10} className="text-amber-500" />
          AI guidance only. Verify before clinical use.
        </button>
        {showDisclaimer && <AiDisclaimer className="mt-1.5" />}
      </div>
    </motion.div>
  );
}
