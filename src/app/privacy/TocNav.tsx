"use client";

import { useEffect, useRef, useState } from "react";

const TOC = [
  { id: "overview",       label: "Overview" },
  { id: "data-collected", label: "Data we collect" },
  { id: "how-we-use",     label: "How we use your data" },
  { id: "role-access",    label: "Role-based access" },
  { id: "ai-processing",  label: "Clinical AI processing" },
  { id: "third-parties",  label: "Third-party services" },
  { id: "security",       label: "Security" },
  { id: "retention",      label: "Data retention & deletion" },
  { id: "your-rights",    label: "Your rights" },
  { id: "cookies",        label: "Cookies & sessions" },
  { id: "data-breach",    label: "Data breaches" },
  { id: "dpdp",           label: "DPDP Act, 2023" },
  { id: "children",       label: "Children’s data" },
  { id: "changes",        label: "Changes to this policy" },
  { id: "contact",        label: "Grievance & contact" },
];

export function TocNav() {
  const [activeId, setActiveId] = useState<string>(TOC[0].id);
  // track the order sections enter the viewport so we always highlight
  // the topmost visible one rather than the last one observed
  const visibleRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const headings = TOC.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleRef.current.add(entry.target.id);
          } else {
            visibleRef.current.delete(entry.target.id);
          }
        });
        // pick the topmost visible section in document order
        for (const { id } of TOC) {
          if (visibleRef.current.has(id)) {
            setActiveId(id);
            return;
          }
        }
      },
      {
        // fire when 10% of the section crosses the viewport's upper 80%
        rootMargin: "-5% 0px -15% 0px",
        threshold: 0.1,
      }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden lg:block lg:w-[clamp(180px,15%,240px)] shrink-0">
        <div className="sticky top-28 rounded-xl bg-white px-4 py-5 ring-1 ring-inset ring-emerald-950/[0.07] 2xl:rounded-2xl 2xl:px-5 2xl:py-6">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 2xl:text-[11px]">
            Contents
          </p>
          <nav aria-label="Privacy policy sections">
            <ul className="flex flex-col gap-0.5">
              {TOC.map(({ id, label }) => {
                const isActive = activeId === id;
                return (
                  <li key={id}>
                    <button
                      onClick={() => scrollTo(id)}
                      className={[
                        "w-full text-left rounded-lg px-2.5 py-1.5 text-[12.5px] transition-all duration-200 2xl:text-[13px] 2xl:py-2",
                        isActive
                          ? "bg-emerald-50 font-semibold text-emerald-800"
                          : "text-slate-500 hover:bg-emerald-50/70 hover:text-emerald-700",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2">
                        {isActive && (
                          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        )}
                        <span className={isActive ? "" : "pl-[14px]"}>{label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* ── Mobile chip strip ─────────────────────────────────────────────── */}
      <div className="mb-6 lg:hidden">
        <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-emerald-950/[0.07]">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Jump to section
          </p>
          <div className="flex flex-wrap gap-2">
            {TOC.map(({ id, label }) => {
              const isActive = activeId === id;
              return (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                    isActive
                      ? "bg-emerald-700 text-white ring-1 ring-emerald-700"
                      : "border border-emerald-950/[0.08] bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
