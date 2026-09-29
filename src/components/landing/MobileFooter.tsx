"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, Phone, ChevronDown } from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "Overview", href: "#platform" },
      { label: "Medical Records", href: "#emr" },
      { label: "Multi-Hospital", href: "#hospitals" },
      { label: "Surgery", href: "#surgery" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Analytics", href: "#analytics" },
      { label: "Security", href: "#security" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Get Started",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Free Trial", href: "/login" },
      { label: "Book a Demo", href: "#contact" },
      { label: "Contact", href: "mailto:support@ppmsai.com" },
    ],
  },
];

function AccordionSection({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-200/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[13.5px] font-semibold text-[#0d1f2d]">{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className="shrink-0 text-slate-400 transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden="true"
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "240px" : "0px" }}
      >
        <ul className="pb-4 flex flex-col gap-0">
          {links.map(({ label, href }) => (
            <li key={label}>
              <a
                href={href}
                className="block py-2.5 text-[14px] text-slate-500 active:text-emerald-700"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MobileFooter() {
  return (
    <footer className="bg-white border-t border-slate-200/60 lg:hidden">
      <div className="px-5 pt-9 pb-8">

        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div className="mb-7">
          <div className="flex items-center gap-2.5 mb-4">
            <Image
              src="/landing/logo-rf-health.webp"
              alt="RF Health"
              width={34}
              height={34}
              className="h-[34px] w-[34px] rounded-xl object-cover ring-1 ring-slate-200"
            />
            <span className="text-[17px] font-bold tracking-tight text-[#0d1f2d]">
              RF Health
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-slate-500 mb-5 max-w-[300px]">
            Smart healthcare technology for modern hospitals and medical practices.
          </p>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              A Product of RAPDFLY
            </p>
            <p className="text-[13px] font-medium text-slate-600">RAPDFLY Private Limited</p>
            <p className="text-[12.5px] text-slate-400">Bangalore, Karnataka, India</p>
          </div>
        </div>

        {/* ── Follow Us ──────────────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">
            Follow Us
          </p>
          <div className="flex items-center gap-3">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/rapdfly_private_limited/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400 active:bg-slate-50 active:text-emerald-700 transition-colors"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4.5" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/in/rapdfly-private-limited-60b169230/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400 active:bg-slate-50 active:text-emerald-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
              </svg>
            </a>
            {/* X / Twitter */}
            <a
              href="https://x.com/rapdfly"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400 active:bg-slate-50 active:text-emerald-700 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25h6.836l4.265 5.638L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            </a>
            {/* Facebook */}
            <a
              href="https://www.facebook.com/profile.php?id=100076345167851"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400 active:bg-slate-50 active:text-emerald-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
          </div>
        </div>

        {/* ── Accordion nav ──────────────────────────────────────────────── */}
        <div className="border-t border-slate-200/70 mb-6">
          {NAV_SECTIONS.map((section) => (
            <AccordionSection key={section.title} {...section} />
          ))}
        </div>

        {/* ── Contact ────────────────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">
            Contact
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="mailto:support@ppmsai.com"
              className="flex items-center gap-2.5 text-[13.5px] text-slate-500 active:text-emerald-700 transition-colors"
            >
              <Mail size={14} strokeWidth={1.5} className="shrink-0 text-slate-400" aria-hidden="true" />
              support@ppmsai.com
            </a>
            <a
              href="tel:+917373351087"
              className="flex items-center gap-2.5 text-[13.5px] text-slate-500 active:text-emerald-700 transition-colors"
            >
              <Phone size={14} strokeWidth={1.5} className="shrink-0 text-slate-400" aria-hidden="true" />
              +91 73733 51087
            </a>
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────────────────────────────── */}
        <div className="border-t border-slate-200/70 pt-6 flex flex-col gap-3">
          <p className="text-[12px] text-slate-400">
            &copy; {new Date().getFullYear()} RAPDFLY Private Limited. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/privacy" className="text-[12px] text-slate-400 active:text-emerald-700 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-[12px] text-slate-400 active:text-emerald-700 transition-colors">
              Terms of Service
            </Link>
            <Link href="/refund" className="text-[12px] text-slate-400 active:text-emerald-700 transition-colors">
              Refund Policy
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
