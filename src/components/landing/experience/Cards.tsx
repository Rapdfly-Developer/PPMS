/**
 * Interactive surfaces — server-rendered, CSS-only hover/press (see
 * "Landing experience" in globals.css).
 *
 * - FeatureCard: lifts 3px, border firms up, shadow deepens a touch, the icon
 *   scales slightly and the arrow slides 4px. ~200ms, no bounce.
 * - MicroInteractionButton: primary / secondary CTA — 1px lift and a soft
 *   shadow on hover, arrow nudges 4px, settles back on press.
 */

import Link from "next/link";
import { ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";

export function FeatureCard({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="lp-card group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 sm:p-6"
    >
      <span className="lp-card-icon flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/10">
        <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="mt-4 text-[15.5px] font-semibold tracking-tight text-emerald-950">{title}</span>
      <span className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-slate-500">{desc}</span>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-teal-700">
        Learn more <ArrowRight size={14} className="lp-card-arrow" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function MicroInteractionButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const base =
    "lp-btn group inline-flex items-center justify-between gap-3 rounded-full py-2 pl-7 pr-2 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2";
  const tone =
    variant === "primary"
      ? "lp-btn-primary bg-emerald-950 font-semibold text-white"
      : "lp-btn-secondary border border-emerald-950/[0.1] bg-white font-medium text-emerald-950";
  return (
    <a href={href} className={`${base} ${tone} ${className}`}>
      {children}
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${variant === "primary" ? "bg-white/12" : "bg-emerald-950/[0.05]"}`}>
        <ArrowUpRight size={17} strokeWidth={1.4} className="lp-btn-arrow" aria-hidden="true" />
      </span>
    </a>
  );
}
