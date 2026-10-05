"use client";

/**
 * Cursor-driven micro-interactions for the landing page only.
 *
 * Mounted once inside <PremiumLanding>. It turns itself on only for a fine
 * pointer that can hover (desktop / laptop / tablet with a mouse) and when
 * the visitor has not asked for reduced motion; otherwise it renders
 * nothing and the page is untouched — phones keep their exact touch UI.
 *
 * When on, it adds `lp-cursor-on` to the landing root (every rule in
 * globals.css is scoped under it) and drives four effects:
 *   - a faint spotlight that trails the cursor (multiply blend, so it can
 *     only tint light areas — text never washes out);
 *   - hero parallax: elements tagged data-lp-depth drift a few px with the
 *     cursor (CSS `translate`, so it composes with their own animations);
 *   - card tilt (≤2.5°) on elements tagged data-lp-tilt;
 *   - a soft highlight that follows the cursor inside data-lp-btn buttons.
 *
 * One passive pointermove listener records the position; a single
 * requestAnimationFrame per frame writes CSS custom properties. No React
 * state, no layout reads beyond one getBoundingClientRect per hovered item.
 */

import { useEffect, useRef } from "react";

const TILT_MAX_DEG = 2.5;

export function CursorEffects() {
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = spotRef.current?.closest<HTMLElement>(".ppms-landing");
    if (!root) return;

    let enabled = false;
    let frame = 0;
    let x = -1000, y = -1000;
    let target: Element | null = null;
    let tiltEl: HTMLElement | null = null;
    let btnEl: HTMLElement | null = null;
    const hero = root.querySelector<HTMLElement>(".lp-hero");

    // The nav is shared with the legal pages, so its CTA is tagged here, at
    // runtime and only inside the landing root, rather than in Nav.tsx.
    root.querySelectorAll<HTMLElement>('header a[href="/license"], nav a[href="/license"]').forEach((a) => {
      if (!a.hasAttribute("data-lp-btn")) a.setAttribute("data-lp-btn", "dark");
    });

    const reset = (el: HTMLElement | null, props: string[]) => props.forEach((p) => el?.style.removeProperty(p));

    const write = () => {
      frame = 0;
      // Spotlight.
      spotRef.current?.style.setProperty("transform", `translate3d(${x}px, ${y}px, 0)`);

      // Hero parallax: -1..1 across the hero, 0 when the cursor is elsewhere.
      if (hero) {
        const r = hero.getBoundingClientRect();
        const inside = y >= r.top && y <= r.bottom;
        hero.style.setProperty("--lp-hx", inside ? (((x - r.left) / r.width) * 2 - 1).toFixed(3) : "0");
        hero.style.setProperty("--lp-hy", inside ? (((y - r.top) / r.height) * 2 - 1).toFixed(3) : "0");
      }

      // Card tilt.
      const nextTilt = (target?.closest("[data-lp-tilt]") as HTMLElement | null) ?? null;
      if (nextTilt !== tiltEl) { reset(tiltEl, ["--lp-rx", "--lp-ry"]); tiltEl = nextTilt; }
      if (tiltEl) {
        const r = tiltEl.getBoundingClientRect();
        const px = (x - r.left) / r.width - 0.5, py = (y - r.top) / r.height - 0.5;
        tiltEl.style.setProperty("--lp-rx", `${(-py * TILT_MAX_DEG * 2).toFixed(2)}deg`);
        tiltEl.style.setProperty("--lp-ry", `${(px * TILT_MAX_DEG * 2).toFixed(2)}deg`);
      }

      // Button highlight position.
      const nextBtn = (target?.closest("[data-lp-btn]") as HTMLElement | null) ?? null;
      if (nextBtn !== btnEl) { reset(btnEl, ["--lp-mx", "--lp-my"]); btnEl = nextBtn; }
      if (btnEl) {
        const r = btnEl.getBoundingClientRect();
        btnEl.style.setProperty("--lp-mx", `${x - r.left}px`);
        btnEl.style.setProperty("--lp-my", `${y - r.top}px`);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(write); };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY; target = e.target as Element;
      root.classList.add("lp-cursor-in");
      schedule();
    };
    const onLeave = () => {
      root.classList.remove("lp-cursor-in");
      target = null; y = -1000;
      schedule();
    };
    const onScroll = () => schedule(); // hero rect moves under a still cursor

    const enable = () => {
      if (enabled) return;
      enabled = true;
      root.classList.add("lp-cursor-on");
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      document.documentElement.addEventListener("mouseleave", onLeave);
    };
    const disable = () => {
      if (!enabled) return;
      enabled = false;
      root.classList.remove("lp-cursor-on", "lp-cursor-in");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      reset(tiltEl, ["--lp-rx", "--lp-ry"]); reset(btnEl, ["--lp-mx", "--lp-my"]);
      reset(hero, ["--lp-hx", "--lp-hy"]);
      tiltEl = btnEl = null;
    };
    const sync = () => (fine.matches && !reduce.matches ? enable() : disable());

    sync();
    fine.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      disable();
    };
  }, []);

  return <div ref={spotRef} aria-hidden="true" className="lp-spotlight" />;
}
