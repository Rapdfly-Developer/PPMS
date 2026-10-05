/**
 * Shared motion language for the PPMS marketing site.
 *
 * Every curve here is a custom cubic-bezier — the landing page never falls back
 * to `linear` or `ease-in-out`, because both read as "default browser transition"
 * rather than as designed motion. `smooth` is the house curve: a heavy decelerate
 * that makes elements feel like they carry mass.
 */

export const EASE = {
  /** Heavy decelerate — the default for anything entering the viewport. */
  smooth: [0.32, 0.72, 0, 1] as const,
  /** Gentle decelerate — short-distance moves, hover states. */
  enter: [0.25, 0.1, 0.25, 1] as const,
  /** Expo out — dramatic single-element reveals (hero headline). */
  expo: [0.16, 1, 0.3, 1] as const,
  /** Accelerate out — exits only. */
  exit: [0.4, 0, 1, 1] as const,
};

export const DURATION = {
  fast: 0.25,
  normal: 0.55,
  slow: 0.85,
};

/** Tailwind-side twin of EASE.smooth, for CSS-only transitions on hover. */
export const CSS_EASE = "cubic-bezier(0.32,0.72,0,1)";

/** Viewport config shared by every scroll reveal — fires once, slightly early. */
export const VIEWPORT = { once: true, margin: "-90px" } as const;
