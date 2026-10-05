"use client";

/**
 * Client-side motion primitives for the marketing site.
 *
 * These are the only client components the landing page ships. Every section is
 * a server component that passes its (server-rendered) content as `children`
 * into one of these wrappers, so the copy itself costs no client JS.
 */

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DURATION, EASE, VIEWPORT } from "./motion";

/* ─── Reveal ──────────────────────────────────────────────────────────────── */

type RevealVariant = "fade" | "heading" | "image";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  /** Distance travelled on entry. Larger for hero-scale blocks. */
  y?: number;
  className?: string;
  /**
   * What is entering, so each kind of content gets its own motion instead of
   * one move stamped on everything:
   * - "fade"    (default) body copy and lists: opacity + rise, no blur — blur
   *             forces a full repaint every frame on large text blocks.
   * - "heading" section headlines: the house move, a rise out of a light blur.
   * - "image"   photo plates: settle from a slight scale-up, like a print
   *             being laid down.
   */
  variant?: RevealVariant;
};

const REVEAL_FROM: Record<RevealVariant, (y: number) => Record<string, number | string>> = {
  fade: (y) => ({ opacity: 0, y }),
  heading: (y) => ({ opacity: 0, y, filter: "blur(6px)" }),
  image: (y) => ({ opacity: 0, y: Math.round(y * 0.6), scale: 1.035 }),
};
const REVEAL_TO: Record<RevealVariant, Record<string, number | string>> = {
  fade: { opacity: 1, y: 0 },
  heading: { opacity: 1, y: 0, filter: "blur(0px)" },
  image: { opacity: 1, y: 0, scale: 1 },
};

/**
 * Scroll-triggered entrance. Under `prefers-reduced-motion` it collapses to a
 * plain, near-instant fade — the content still arrives, it just stops moving.
 */
export function Reveal({ children, delay = 0, y = 28, className, variant = "fade" }: RevealProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : REVEAL_FROM[variant](y)}
      whileInView={reduce ? { opacity: 1 } : REVEAL_TO[variant]}
      viewport={VIEWPORT}
      transition={{
        duration: reduce ? 0.01 : variant === "fade" ? DURATION.normal + 0.1 : DURATION.slow,
        delay: reduce ? 0 : delay,
        ease: EASE.smooth,
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Stagger group ───────────────────────────────────────────────────────── */

export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduce ? 0 : stagger,
            delayChildren: reduce ? 0 : delayChildren,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        // No blur: list rows are body text, and animating filter on them
        // repainted every row on every frame.
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: reduce ? 0.01 : DURATION.normal,
            ease: EASE.smooth,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Parallax ────────────────────────────────────────────────────────────── */

/**
 * Drifts a block against the scroll direction. Transform-only, spring-smoothed
 * so the raw scroll value never shows through as jitter.
 */
export function Parallax({
  children,
  distance = 44,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 28 });
  const y = useTransform(smooth, [0, 1], [distance, -distance]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

/* ─── Scroll rail ───────────────────────────────────────────────────────── */

/**
 * A connector line beside a sequence of steps that draws itself as the reader
 * scrolls through them, so the steps read as one journey rather than four
 * separate cards. Transform-only (scaleY), spring-smoothed.
 */
export function ScrollRail({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <div ref={ref} className={`relative sm:pl-7 ${className ?? ""}`}>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-7 left-2 top-7 hidden w-[2px] rounded-full bg-emerald-950/[0.07] sm:block" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-7 left-2 top-7 hidden w-[2px] origin-top rounded-full bg-gradient-to-b from-emerald-400 to-teal-500 sm:block"
        style={{ scaleY: reduce ? 1 : progress }}
      />
      {children}
    </div>
  );
}

/* ─── Magnetic CTA ────────────────────────────────────────────────────────── */

/**
 * Primary buttons pull slightly toward the cursor and compress on press, so a
 * click has a physical "give" to it rather than an instant colour swap.
 */
export function Magnetic({
  children,
  href,
  className,
  strength = 0.28,
}: {
  children: ReactNode;
  href: string;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20 });
  const sy = useSpring(y, { stiffness: 260, damping: 20 });

  return (
    <motion.a
      href={href}
      data-lp-btn="dark"
      className={className}
      style={reduce ? undefined : { x: sx, y: sy }}
      whileTap={{ scale: 0.975 }}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.a>
  );
}

/* ─── Counter ─────────────────────────────────────────────────────────────── */

/**
 * Counts up once, when the stat scrolls into view. `format` keeps the thousands
 * separator locale-correct rather than hand-rolling a regex.
 */
export function Counter({
  to,
  suffix = "",
  decimals = 0,
}: {
  to: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  // Starts at the real figure so the server HTML (and search engines, link
  // previews and no-JS readers) show "500+" rather than "0+". Once hydrated it
  // rewinds to 0 out of view, then counts up when scrolled into view.
  const [value, setValue] = useState(to);
  const armed = useRef(false);

  useEffect(() => {
    if (reduce || armed.current) return;
    armed.current = true;
    const t = setTimeout(() => setValue(0), 0);
    return () => clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: EASE.expo,
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ─── Marquee ─────────────────────────────────────────────────────────────── */

/**
 * Infinite logo/label strip. Duplicated content plus a transform-only keyframe
 * loop — no scroll listener, no layout-triggering properties.
 */
export function Marquee({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const reduce = useReducedMotion();

  const half = (hidden: boolean) => (
    <div className="flex shrink-0 gap-3 pr-3" aria-hidden={hidden || undefined}>
      {items.map((label) => (
        <span
          key={label}
          className="whitespace-nowrap rounded-full border border-emerald-900/[0.07] bg-white px-5 py-2.5 text-[13px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,42,35,0.04)]"
        >
          {label}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      aria-label="Capabilities included in every RF Health plan"
    >
      <div
        className="ppms-marquee-track flex w-max will-change-transform"
        style={reduce ? undefined : { animation: "ppms-marquee 46s linear infinite" }}
      >
        {half(false)}
        {half(true)}
      </div>
      {/* Feather the strip into the page rather than letting it hard-clip.
          Narrow on phones — an 80px mask either side would eat half a 320px
          viewport and leave barely a chip visible. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent sm:w-20" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:w-20" />
    </div>
  );
}
