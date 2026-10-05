"use client";

/**
 * First-visit cookie banner. Non-blocking: a compact card at the bottom-left
 * on desktop, a bottom sheet on phones; the page stays usable behind it.
 * Reject All carries the same weight as Accept All.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Cookie } from "lucide-react";

const BTN =
  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-[14px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2";

export function CookieBanner({
  onAcceptAll,
  onRejectAll,
  onCustomize,
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      role="region"
      aria-labelledby="rf-cookie-title"
      aria-describedby="rf-cookie-desc"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.4 }}
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white px-4 pt-4 text-slate-700 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.18)] print:hidden sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[min(27rem,calc(100vw-2.5rem))] sm:rounded-2xl sm:border sm:p-5 sm:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.22)]"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 sm:flex" aria-hidden="true">
          <Cookie size={18} strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <h2 id="rf-cookie-title" className="text-[16px] font-semibold tracking-tight text-slate-900">Cookies on RF Health</h2>
          <p id="rf-cookie-desc" className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
            We use cookies and similar technologies to keep RF Health secure, provide essential functionality, understand
            how our website is used, and improve your experience. You can manage your preferences at any time.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_1fr]">
        <button type="button" data-cookie-customize onClick={onCustomize} className={`${BTN} order-last col-span-2 text-slate-700 underline-offset-4 hover:bg-slate-50 hover:underline sm:order-none sm:col-span-1 sm:px-3`}>
          Customize
        </button>
        <button type="button" onClick={onRejectAll} className={`${BTN} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}>
          Reject All
        </button>
        <button type="button" onClick={onAcceptAll} className={`${BTN} bg-emerald-950 text-white hover:bg-emerald-900`}>
          Accept All
        </button>
      </div>
    </motion.section>
  );
}
