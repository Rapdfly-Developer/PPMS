"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useMotionValueEvent, useSpring } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { DURATION, EASE } from "./motion";

const LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Records", href: "#emr" },
  { label: "Hospitals", href: "#hospitals" },
  { label: "Analytics", href: "#analytics" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

/**
 * A floating glass pill detached from the top edge, not an edge-to-edge bar.
 * It tightens (loses horizontal padding, gains shadow) once the page scrolls,
 * which is the only state change — the pill never docks.
 */
export function Nav() {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const reduce = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();

  // Read position across the page. Spring-smoothed so the bar glides instead of
  // tracking raw scroll jitter; scaleX only, so it stays on the compositor.
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useMotionValueEvent(scrollY, "change", (v) => setLifted(v > 24));

  // Hold the page still behind the overlay, otherwise a scroll gesture on the
  // menu carries through to the document underneath it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-4 sm:px-4 sm:pt-6">
        <nav
          className={[
            "pointer-events-auto flex w-full max-w-5xl items-center gap-1.5 rounded-full sm:gap-2 xl:max-w-6xl",
            "border border-emerald-950/[0.06] bg-white/75 backdrop-blur-xl",
            "transition-[padding,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            lifted
              ? "px-2.5 py-2 shadow-[0_10px_40px_-12px_rgba(6,60,45,0.22)] sm:px-3"
              : "px-3 py-2 shadow-[0_2px_18px_-8px_rgba(6,60,45,0.12)] sm:px-4 sm:py-2.5",
            "relative overflow-hidden",
          ].join(" ")}
        >
          {/* Reading progress, hairline along the bottom of the pill. Fades in
              only once the page has actually been scrolled, so it does not
              advertise itself on a fresh load. */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-emerald-500 to-teal-400"
            style={reduce ? { scaleX: 0 } : { scaleX: progress }}
            animate={{ opacity: lifted ? 1 : 0 }}
            transition={{ duration: 0.4, ease: EASE.enter }}
          />

          <a href="#top" className="flex shrink-0 items-center gap-2 rounded-full pr-1 sm:gap-2.5 sm:pl-1 sm:pr-2">
            <Image
              src="/landing/logo-ppms-new.png"
              alt="PPMS"
              width={30}
              height={30}
              priority
              className="h-[30px] w-[30px] rounded-lg object-contain"
            />
            <span className="font-display text-[15px] font-bold tracking-tight text-emerald-950">
              PPMS
            </span>
          </a>

          <div className="mx-auto hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                /* Underline wipes in from the left on hover — a transform on a
                   pseudo-element, so it never triggers layout. */
                className="group/nav relative rounded-full px-3.5 py-2 text-[13.5px] font-medium text-slate-600 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-emerald-50 hover:text-emerald-800 after:absolute after:inset-x-3.5 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-emerald-700/60 after:transition-transform after:duration-500 after:ease-[cubic-bezier(0.32,0.72,0,1)] hover:after:scale-x-100"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <a
              href="/login"
              className="hidden rounded-full px-4 py-2 text-[13.5px] font-medium text-slate-600 transition-colors duration-300 hover:text-emerald-800 sm:block"
            >
              Sign in
            </a>
            <a
              href="/login"
              className="group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-950 py-1.5 pl-3.5 pr-1.5 text-[13px] font-semibold text-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:gap-2 sm:pl-4 sm:text-[13.5px]"
            >
              Free trial
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:scale-105">
                <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </span>
            </a>

            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-950/[0.07] sm:ml-1 lg:hidden"
            >
              {/* Two bars that rotate into an X rather than swapping icons. */}
              <span
                className={[
                  "absolute h-[1.5px] w-4 rounded-full bg-emerald-950",
                  "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  open ? "translate-y-0 rotate-45" : "-translate-y-[3px]",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute h-[1.5px] w-4 rounded-full bg-emerald-950",
                  "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  open ? "translate-y-0 -rotate-45" : "translate-y-[3px]",
                ].join(" ")}
              />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            /* Scrollable and top-padded rather than hard-centred: six links plus
               two CTAs do not fit a landscape phone, and a centred flex column
               would clip them with no way to reach them. */
            className="fixed inset-0 z-30 flex flex-col justify-center overflow-y-auto overscroll-contain bg-white/85 px-6 pb-10 pt-24 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE.enter }}
          >
            <motion.ul
              className="flex flex-col gap-1"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: reduce ? 0 : 0.055, delayChildren: 0.05 } },
              }}
            >
              {LINKS.map((l) => (
                <motion.li
                  key={l.href}
                  variants={{
                    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 40 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: reduce ? 0.01 : 0.6, ease: EASE.smooth },
                    },
                  }}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="font-display block py-2.5 text-[clamp(1.6rem,7vw,2rem)] font-bold tracking-tight text-emerald-950 sm:py-3"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              className="mt-10 flex flex-col gap-3"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.34, duration: 0.6, ease: EASE.smooth }}
            >
              <a
                href="/login"
                className="rounded-full bg-emerald-950 px-6 py-4 text-center text-[15px] font-semibold text-white"
              >
                Start 30-day free trial
              </a>
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="rounded-full border border-emerald-950/10 px-6 py-4 text-center text-[15px] font-medium text-emerald-950"
              >
                Book a demo
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
