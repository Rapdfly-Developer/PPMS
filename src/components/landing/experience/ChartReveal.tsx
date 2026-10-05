"use client";

/**
 * Chart primitives that draw themselves once, the first time they scroll into
 * view: a line traced left to right, bars growing from the baseline, and a
 * ring filling its stroke. Transform / stroke-dashoffset only, so each costs a
 * single composited animation and nothing runs after it settles.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { EASE } from "../motion";

const TEAL = "#0F766E";

/** Shared trigger: in view once, slightly early. */
function useOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, margin: "-40px 0px" });
  return [ref, inView] as const;
}

/* ─── Line ───────────────────────────────────────────────────────────────── */

export function LineChartReveal({
  values,
  delay = 0,
  className,
  label,
}: {
  values: number[];
  delay?: number;
  className?: string;
  /** Accessible description of what the line shows. */
  label: string;
}) {
  const [ref, inView] = useOnce<SVGSVGElement>();
  const reduce = useReducedMotion();
  const W = 100, H = 36, pad = 2;
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2),
  ]);
  // Smooth the polyline with midpoint quadratic curves.
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    return `${acc} Q${px},${py} ${(px + x) / 2},${(py + y) / 2}`;
  }, "") + ` T${pts[pts.length - 1][0]},${pts[pts.length - 1][1]}`;
  const show = reduce || inView;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} className={className}>
      <defs>
        <linearGradient id="lp-line-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={TEAL} stopOpacity="0.16" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${d} L${W},${H} L0,${H} Z`}
        fill="url(#lp-line-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: show ? 1 : 0 }}
        transition={{ duration: 0.8, delay: reduce ? 0 : delay + 0.9 }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke={TEAL}
        strokeWidth={1.4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: show ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 1.4, delay: reduce ? 0 : delay, ease: EASE.smooth }}
      />
    </svg>
  );
}

/* ─── Bars ───────────────────────────────────────────────────────────────── */

export function BarsReveal({
  values,
  delay = 0,
  className,
  label,
}: {
  values: number[];
  delay?: number;
  className?: string;
  label: string;
}) {
  const [ref, inView] = useOnce<HTMLDivElement>();
  const reduce = useReducedMotion();
  const max = Math.max(...values);
  return (
    <div ref={ref} role="img" aria-label={label} className={`flex items-end gap-[6%] ${className ?? ""}`}>
      {values.map((v, i) => (
        <motion.span
          key={i}
          className="block flex-1 origin-bottom rounded-t-[3px] bg-teal-600/80"
          style={{ height: `${(v / max) * 100}%` }}
          initial={{ scaleY: reduce ? 1 : 0 }}
          animate={{ scaleY: reduce || inView ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay + i * 0.06, ease: EASE.smooth }}
        />
      ))}
    </div>
  );
}

/* ─── Ring ───────────────────────────────────────────────────────────────── */

export function RingReveal({
  value,
  size = 56,
  delay = 0,
  label,
  children,
}: {
  /** 0–1 */
  value: number;
  size?: number;
  delay?: number;
  label: string;
  children?: React.ReactNode;
}) {
  const [ref, inView] = useOnce<HTMLDivElement>();
  const reduce = useReducedMotion();
  const r = 15.5, c = 2 * Math.PI * r;
  return (
    <div ref={ref} role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100" />
        <motion.circle
          cx="18" cy="18" r={r} fill="none" stroke={TEAL} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - value) : c }}
          animate={{ strokeDashoffset: reduce || inView ? c * (1 - value) : c }}
          transition={{ duration: reduce ? 0 : 1.2, delay: reduce ? 0 : delay, ease: EASE.smooth }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
