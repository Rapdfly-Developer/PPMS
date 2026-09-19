"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PackageOpen, X } from "lucide-react";

/**
 * Guards the exit from an UNFINALISED consultation.
 *
 * Two jobs:
 *  1. Start the consultation clock the first time this EMR is opened. The
 *     clock lives in sessionStorage, keyed by visit id — no database column
 *     and no server round-trip. It therefore survives a refresh, is scoped to
 *     this tab (two tabs on two visits cannot collide), and disappears when
 *     the tab closes.
 *  2. Intercept every way of leaving the EMR while the visit is still open,
 *     and ask what should happen to the consultation.
 *
 * Scoping: this component only ever mounts on the EMR route, and only for a
 * visit that is not closed. Every listener it installs is removed on unmount,
 * so no other page in the app is affected. Nothing is added to TopBar or to the
 * shared BackButton, both of which are used app-wide.
 *
 * Interception covers three distinct mechanisms, because no single one catches
 * them all:
 *  - In-app navigation (TopBar Back, sidebar links, any <a>): a capture-phase
 *    click listener on the document. Capture phase matters — Next's <Link> has
 *    its own click handler, and a bubble-phase listener would run after it.
 *  - Browser/hardware back: a sentinel history entry plus a popstate listener.
 *    The entry is pushed on mount, so the first back lands on it rather than
 *    leaving; we then re-push it and show the dialog.
 *  - Tab close / reload: beforeunload. The browser shows its own generic
 *    prompt here and the wording cannot be customised, so this is a backstop
 *    rather than the real dialog.
 */
/**
 * sessionStorage key for one visit's consultation clock. Keyed by visit id so
 * two visits open in two tabs keep separate clocks, and a stale key from an
 * earlier visit can never be mistaken for this one's.
 */
export const consultClockKey = (visitId: string) => `emr_consult_start_${visitId}`;

export function ConsultationExitGuard({
  visitId,
  exitHref,
  active,
  onPartialDispense,
}: {
  visitId: string;
  /**
   * Where "OK" goes when the blocked navigation had no destination of its own
   * (the browser/hardware Back, and the TopBar Back button, which renders as a
   * plain <button> calling router.back() whenever no returnTo is present).
   * Normally the returnTo param.
   */
  exitHref: string;
  /** False once the visit is closed/finalised — the guard then does nothing. */
  active: boolean;
  /** Opens the EMR action bar's existing PartialDispenseModal. */
  onPartialDispense: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Where the blocked navigation was heading. null => browser back.
  const pendingHref = useRef<string | null>(null);
  // Set while we are performing the navigation the user just approved, so the
  // listeners below let it through instead of re-prompting.
  const allowNav = useRef(false);
  // Mirrored into a ref so the long-lived listeners below read the CURRENT
  // value without being torn down and re-added on every change. Written in an
  // effect, not during render -- a ref write during render is a side effect.
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  /* ── 1. Start the clock ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!active) return;
    // Only stamp when absent, so a refresh or React Strict Mode's double
    // effect does not move the start time.
    try {
      const key = consultClockKey(visitId);
      if (!window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, new Date().toISOString());
      }
    } catch {
      // Private mode or blocked storage: the guard still works, the timing
      // simply is not recorded. Never let this break the EMR.
    }
  }, [active, visitId]);

  /* ── 2a. In-app link clicks ───────────────────────────────────────────── */
  useEffect(() => {
    if (!active) return;

    const onClick = (e: MouseEvent) => {
      if (allowNav.current || !activeRef.current) return;
      // Let modified clicks (new tab/window) and non-primary buttons through.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href") ?? "";
      // Ignore in-page anchors, other protocols and downloads.
      if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href) && !href.startsWith("http")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Staying inside this EMR (tab links, query changes) is not an exit.
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      pendingHref.current = url.pathname + url.search;
      setOpen(true);
    };

    document.addEventListener("click", onClick, true); // capture
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  /* ── 2b. Browser / hardware back ──────────────────────────────────────── */
  useEffect(() => {
    if (!active) return;

    // Sentinel entry: the first Back press pops this instead of leaving.
    window.history.pushState({ emrGuard: true }, "");

    const onPop = () => {
      if (allowNav.current || !activeRef.current) return;
      // Re-arm the sentinel so we stay put, then ask.
      window.history.pushState({ emrGuard: true }, "");
      pendingHref.current = null;
      setOpen(true);
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [active]);

  /* ── 2c. Tab close / reload ───────────────────────────────────────────── */
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNav.current || !activeRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  /* ── Dialog actions ───────────────────────────────────────────────────── */

  /*
   * Every exit resolves to a concrete URL.
   *
   * router.back() cannot be used for the no-destination case: the guard keeps a
   * sentinel history entry on top of the EMR so the first Back press is
   * catchable, and popstate re-pushes it. Going back one step therefore just
   * consumes that sentinel and lands on the EMR again -- the user pressed OK
   * and stayed exactly where they were. Pushing/replacing a real href is the
   * only way to leave deterministically, whatever the history stack looks like.
   *
   * replace, not push, for that case: it overwrites the sentinel rather than
   * stacking another entry on top of it, so the destination's own Back button
   * does not lead straight back into the EMR.
   */
  const proceed = useCallback(() => {
    allowNav.current = true;
    const href = pendingHref.current;
    setOpen(false);
    if (href) router.push(href);
    else router.replace(exitHref);
  }, [router, exitHref]);

  // OK: discard the consultation timing, then leave. Clearing sessionStorage
  // is synchronous, so navigation happens in the same tick — there is no
  // server round-trip to await before the screen changes.
  const onOk = () => {
    try {
      window.sessionStorage.removeItem(consultClockKey(visitId));
    } catch {
      /* storage unavailable — nothing to clear */
    }
    proceed();
  };

  // Partial Dispense: stay here and hand over to the existing modal.
  const onPartial = () => {
    setOpen(false);
    pendingHref.current = null;
    onPartialDispense();
  };

  const onCancel = () => {
    setOpen(false);
    pendingHref.current = null;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emr-exit-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--color-border)]">
          <span className="mt-0.5 shrink-0 text-amber-600">
            <AlertTriangle size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="emr-exit-title" className="text-[15px] sm:text-base font-bold text-[var(--color-ink-900)]">
              Your progress will be lost
            </h2>
            <p className="mt-1 text-[13px] sm:text-sm text-[var(--color-ink-500)]">
              The consultation duration for this visit will be reset. Do you wish to
              partially dispense instead?
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onPartial}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
          >
            <PackageOpen size={14} /> Partial Dispense
          </button>
          <button
            type="button"
            onClick={onOk}
            className="px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold bg-[var(--color-primary-600)] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
