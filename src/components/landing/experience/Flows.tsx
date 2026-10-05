/**
 * Flow diagrams that explain how RF Health connects things — server-rendered,
 * CSS-animated (see "Landing experience" in globals.css).
 *
 * - WorkflowTimeline: patient → … → analytics. Horizontal from lg, a vertical
 *   timeline below it. A single signal travels the connector; each node
 *   brightens as the signal passes it.
 * - AiPipeline: healthcare data → AI analysis → clinical insight → doctor
 *   decision, with small particles moving between stages.
 */

import {
  BarChart3, BrainCircuit, CalendarCheck2, ClipboardList, Database, FlaskConical,
  Lightbulb, Pill, ReceiptIndianRupee, Stethoscope, UserRound, UserRoundCheck, UsersRound,
} from "lucide-react";
import { Fragment } from "react";
import { RevealGroup, RevealItem } from "../ui";

const STEPS = [
  { label: "Patient", desc: "Registered once, one UHID", icon: UserRound },
  { label: "Reception", desc: "Checked in at the front desk", icon: UsersRound },
  { label: "Appointment", desc: "Booked against your hours", icon: CalendarCheck2 },
  { label: "Doctor", desc: "Seen from the live queue", icon: Stethoscope },
  { label: "Clinical record", desc: "Exam, diagnosis, plan", icon: ClipboardList },
  { label: "Prescription", desc: "Printed and dispensed", icon: Pill },
  { label: "Investigation", desc: "Ordered, results attached", icon: FlaskConical },
  { label: "Billing", desc: "Settled at the counter", icon: ReceiptIndianRupee },
  { label: "Analytics", desc: "Practice-wide insight", icon: BarChart3 },
];

/** Seconds for the signal to cross the whole workflow once. */
const TRAVEL = 13.5;

export function WorkflowTimeline() {
  const step = TRAVEL / STEPS.length;
  return (
    <div className="relative">
      {/* Connector + travelling signal. Horizontal at lg, vertical below. */}
      <div aria-hidden="true" className="lp-flow-track lp-flow-track-v lg:hidden" style={{ ["--lp-travel" as string]: `${TRAVEL}s` } as React.CSSProperties}>
        <span className="lp-flow-signal" />
      </div>
      <div aria-hidden="true" className="lp-flow-track lp-flow-track-h hidden lg:block" style={{ ["--lp-travel" as string]: `${TRAVEL}s` } as React.CSSProperties}>
        <span className="lp-flow-signal" />
      </div>

      <RevealGroup className="relative grid gap-5 lg:grid-cols-9 lg:gap-3" stagger={0.08}>
        {STEPS.map((s, i) => (
          <RevealItem key={s.label} y={16}>
            <div className="flex items-start gap-4 lg:flex-col lg:items-center lg:gap-3 lg:text-center">
              <span
                className="lp-flow-node relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-teal-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                style={{ ["--lp-node-at" as string]: `${i * step}s`, ["--lp-travel" as string]: `${TRAVEL}s` } as React.CSSProperties}
              >
                <s.icon size={18} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="pt-1 lg:pt-0">
                <span className="block text-[14px] font-semibold tracking-tight text-emerald-950">{s.label}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{s.desc}</span>
              </span>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}

const STAGES = [
  { label: "Healthcare data", desc: "History, examination, vitals and investigations already in the record.", icon: Database },
  { label: "AI analysis", desc: "The co-pilot reviews the visit against the patient's history.", icon: BrainCircuit, ai: true },
  { label: "Clinical insight", desc: "Possible diagnoses and guidance, with the reasoning shown.", icon: Lightbulb },
  { label: "Doctor decision", desc: "You review, accept or ignore. Nothing is applied on its own.", icon: UserRoundCheck },
];

export function AiPipeline() {
  return (
    <RevealGroup className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-0" stagger={0.1}>
      {STAGES.map((s, i) => (
        <Fragment key={s.label}>
          <RevealItem y={14} className="h-full">
            <div className={`flex h-full flex-col rounded-2xl border p-4 ${s.ai ? "border-teal-200/80 bg-teal-50/40" : "border-slate-200/80 bg-white"}`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.ai ? "lp-ai-breathe bg-white text-teal-700 ring-1 ring-teal-600/20" : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/80"}`}>
                <s.icon size={17} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <p className="mt-3 text-[14px] font-semibold tracking-tight text-emerald-950">{s.label}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
            </div>
          </RevealItem>
          {i < STAGES.length - 1 && (
            <div aria-hidden="true" className="lp-pipe flex items-center justify-center md:w-10">
              <span className="lp-pipe-line">
                <span className="lp-pipe-dot" style={{ animationDelay: "0s" }} />
                <span className="lp-pipe-dot" style={{ animationDelay: "0.9s" }} />
                <span className="lp-pipe-dot" style={{ animationDelay: "1.8s" }} />
              </span>
            </div>
          )}
        </Fragment>
      ))}
    </RevealGroup>
  );
}
