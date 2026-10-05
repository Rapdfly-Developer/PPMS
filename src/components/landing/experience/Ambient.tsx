/**
 * Hero atmosphere — server-rendered, CSS-only (see "Landing experience" in
 * globals.css). No JS, no canvas, no filter animation:
 *
 * - AnimatedBackground: a fine dotted grid faded at the edges, plus three
 *   soft navy / teal / blue light fields that drift on 19–27s loops. The
 *   fields are radial-gradient fills (no blur filter), moved by transform.
 * - DataNodes: a sparse field of tiny points that, a few at a time, brighten
 *   and send out one soft ring — the platform quietly working. Fewer nodes on
 *   phones and tablets; none under prefers-reduced-motion.
 */

export function AnimatedBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="lp-dot-grid absolute inset-0" />
      <div className="lp-field lp-field-a" />
      <div className="lp-field lp-field-b" />
      <div className="lp-field lp-field-c" />
    </div>
  );
}

/**
 * Positions are percentages of the hero, kept to the margins and the space
 * around the product preview so no node sits behind the headline. `tier`
 * controls density: 1 everywhere, 2 from sm, 3 from lg.
 */
const NODES: { x: number; y: number; tier: 1 | 2 | 3 }[] = [
  { x: 6, y: 14, tier: 2 }, { x: 18, y: 6, tier: 3 }, { x: 44, y: 9, tier: 3 },
  { x: 58, y: 4, tier: 2 }, { x: 72, y: 11, tier: 1 }, { x: 88, y: 7, tier: 2 },
  { x: 95, y: 26, tier: 1 }, { x: 52, y: 30, tier: 3 }, { x: 97, y: 52, tier: 3 },
  { x: 91, y: 78, tier: 2 }, { x: 76, y: 92, tier: 1 }, { x: 55, y: 88, tier: 3 },
  { x: 47, y: 62, tier: 3 }, { x: 3, y: 58, tier: 2 }, { x: 9, y: 90, tier: 1 },
  { x: 30, y: 95, tier: 3 },
];

const TIER = { 1: "", 2: "hidden sm:block", 3: "hidden lg:block" } as const;

export function DataNodes() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {NODES.map((n, i) => (
        <span
          key={i}
          className={`lp-node ${TIER[n.tier]}`}
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            // Spread activations across the 12s cycle so one or two are lit at a time.
            ["--lp-node-delay" as string]: `${((i * 5) % 16) * 0.75}s`,
          } as React.CSSProperties}
        >
          <span className="lp-node-ring" />
        </span>
      ))}
    </div>
  );
}
