import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarRange,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  ClipboardPlus,
  MessageSquareText,
  Sparkles,
  Cloud,
  Database,
  Fingerprint,
  History,
  Lock,
  Mail,
  MapPin,
  Phone,
  Pill,
  ReceiptIndianRupee,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";

import { Faq, type FaqItem } from "./Faq";
import { WorkflowTabs } from "./WorkflowTabs";
import { Nav } from "./Nav";
import { DemoForm } from "./DemoForm";
import { Magnetic, Marquee, Reveal, RevealGroup, RevealItem } from "./ui";

const IMG = "/landing/v3";

/* ═══ Shared primitives (server-rendered — no client JS) ═══════════════════ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/[0.08] bg-emerald-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
      {children}
    </span>
  );
}

/**
 * The Double-Bezel: every image sits in a machined tray rather than flat on the
 * page — an outer shell with its own tint and hairline, and an inner core with a
 * concentric (smaller) radius and an inset highlight along its top edge.
 */
function Frame({
  src,
  alt,
  aspect,
  sizes,
  priority = false,
  quality = 80,
  className = "",
  radius = "2rem",
}: {
  src: string;
  alt: string;
  aspect: string;
  sizes: string;
  priority?: boolean;
  quality?: number;
  className?: string;
  radius?: string;
}) {
  return (
    <div
      className={`bg-gradient-to-b from-emerald-950/[0.055] to-emerald-950/[0.015] p-2 ring-1 ring-inset ring-emerald-950/[0.06] shadow-[0_50px_90px_-50px_rgba(6,60,45,0.35)] ${className}`}
      style={{ borderRadius: radius }}
    >
      <div
        className={`relative overflow-hidden bg-slate-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] ${aspect}`}
        style={{ borderRadius: `calc(${radius} - 0.5rem)` }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={quality}
          priority={priority}
          className="object-cover object-center"
        />
      </div>
    </div>
  );
}

/**
 * One measure for the whole page. The ladder itself now lives in globals.css
 * as the container-fluid utility, so the app shell and this page cannot drift
 * apart. Capped through desktop so line length stays readable, then growing
 * on wide displays, with each large step a min(94vw, cap) so the column
 * tracks the viewport between breakpoints rather than stepping and holding.
 */
const SHELL = "container-fluid";

/** Horizontal gutter, shared by Section, the hero and the footer so all three
 *  edges line up at every width. Also lives in globals.css, so the two stay
 *  in step without either file having to know the other's numbers. */
const GUTTER = "gutter-fluid";

function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`lp-section scroll-mt-24 sm:scroll-mt-28 ${GUTTER} py-9 sm:py-11 md:py-12 lg:py-16 ${className}`}
    >
      <div className={SHELL}>{children}</div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  lede,
  align = "center",
}: {
  /** Omitted inside WorkflowTabs, where the tab label already names the panel. */
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  align?: "center" | "left";
}) {
  return (
    <Reveal className={align === "center" ? "mx-auto max-w-[var(--lp-measure)] text-center" : "max-w-[var(--lp-measure)]"}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {/* Fluid between 320px and ~1536px, then pinned — clamp keeps the headline
          inside a 320px viewport without a stack of breakpoint overrides. */}
      <h2 className="font-display mt-4 text-[length:var(--lp-h2)] font-bold leading-[1.06] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-5">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-[length:var(--lp-lede)] leading-relaxed text-slate-600 sm:mt-5">
          {lede}
        </p>
      )}
    </Reveal>
  );
}

/** Alternating image + copy block. Reverses to image-right on `flip`. */
function Split({
  eyebrow,
  title,
  lede,
  points,
  flip = false,
  extras,
  children,
}: {
  /** Omitted inside WorkflowTabs, where the tab label already names the panel. */
  eyebrow?: string;
  title: React.ReactNode;
  lede: string;
  points: { icon: React.ReactNode; label: string; desc: string }[];
  flip?: boolean;
  /** Optional content rendered below the bullet points to fill vertical space. */
  extras?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <Reveal>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className="font-display mt-4 text-[length:var(--lp-h2-split)] font-bold leading-[1.07] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-5">
            {title}
          </h2>
          <p className="mt-4 text-[length:var(--lp-lede)] leading-relaxed text-slate-600 sm:mt-5">
            {lede}
          </p>
        </Reveal>

        <RevealGroup className="mt-6 flex flex-col gap-0.5 sm:mt-8" stagger={0.07} delayChildren={0.1}>
          {points.map((p) => (
            <RevealItem key={p.label}>
              {/* The row lifts a little on hover as well as tinting, so the
                  whole block reads as interactive rather than just colour-shifting. */}
              <div className="group/pt flex gap-3.5 rounded-2xl px-3 py-3.5 transition-[background-color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-emerald-50/70 sm:gap-4 sm:px-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_1px_2px_rgba(6,60,45,0.05)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/pt:scale-110">
                  {p.icon}
                </span>
                <div>
                  <div className="text-[15px] font-semibold tracking-tight text-emerald-950">
                    {p.label}
                  </div>
                  <div className="mt-1 text-[14.5px] leading-relaxed text-slate-600">{p.desc}</div>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        {extras && (
          <Reveal delay={0.28}>
            <div className="mt-6 sm:mt-8">{extras}</div>
          </Reveal>
        )}
      </div>

      <div className={flip ? "lg:order-1" : ""}>{children}</div>
    </div>
  );
}


/* ── WorkflowTabs panels ───────────────────────────────────────────────────
   Bodies of the former #journey / #surgery / #analytics sections, moved here
   verbatim apart from the eyebrow, which the tab label above now supplies. */

function JourneyPanel() {
  return (
    <>
      <SectionHead
        title={<>From first call to follow-up, on one thread.</>}
        lede="Every stage writes to the same record, so the next person to see the patient starts from what actually happened rather than from what was remembered."
      />

      <div className="mt-8 grid gap-5 sm:mt-10 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <Frame
            src={`${IMG}/patient-preliminary-analysis-scan.jpg`}
            alt="A clinician reviewing a patient's preliminary analysis on a full-body diagnostic display"
            aspect="aspect-[2/3]"
            sizes="(max-width: 1024px) 92vw, 50vw"
            quality={82}
            radius="2.25rem"
          />
        </Reveal>

        <div className="flex flex-col gap-6">
          <Reveal delay={0.08}>
            <Frame
              src={`${IMG}/wearable-vitals-hologram.jpg`}
              alt="Vital signs displayed above a wearable device during remote patient monitoring"
              aspect="aspect-[4/3]"
              sizes="(max-width: 1024px) 92vw, 42vw"
              quality={80}
              radius="2rem"
            />
          </Reveal>

          <RevealGroup className="flex flex-1 flex-col gap-3" stagger={0.07}>
            {[
              { n: "01", t: "Booking", d: "Front desk or patient books against your real availability at that hospital." },
              { n: "02", t: "Consultation", d: "Vitals, notes, diagnosis and plan captured in the room." },
              { n: "03", t: "Investigation", d: "Labs and imaging ordered, results attached back to the same visit." },
              { n: "04", t: "Follow-up", d: "Next appointment, repeat prescription and reminders scheduled before they leave." },
            ].map((s) => (
              <RevealItem key={s.n}>
                <div className="flex items-start gap-5 rounded-2xl bg-white p-5 3xl:p-7 4xl:p-8 ring-1 ring-inset ring-emerald-950/[0.07] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-[0_20px_44px_-34px_rgba(6,60,45,0.5)]">
                  <span className="font-display text-[13px] font-bold tracking-[0.1em] text-emerald-500">
                    {s.n}
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold tracking-tight text-emerald-950">
                      {s.t}
                    </div>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{s.d}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </>
  );
}

function SurgeryPanel() {
  return (
      <Split
        title={<>Every operation, documented the same way.</>}
        lede="Schedule the theatre, record the operative note against a consistent structure, and keep the pre-op diagnosis, findings and post-op plan attached to the patient's timeline."
        points={[
          {
            icon: <Stethoscope size={17} strokeWidth={1.25} />,
            label: "Structured operative notes",
            desc: "Pre-op and post-op diagnosis, procedure, surgeon, anaesthesia and complications, the same fields every time.",
          },
          {
            icon: <CalendarRange size={17} strokeWidth={1.25} />,
            label: "Theatre scheduling",
            desc: "Book the slot against the hospital's calendar, with the surgical team attached.",
          },
          {
            icon: <ScanLine size={17} strokeWidth={1.25} />,
            label: "Imaging alongside the note",
            desc: "Scans and reports sit with the operative record instead of in a separate folder.",
          },
        ]}
        extras={
          <div className="rounded-2xl bg-emerald-950 px-5 py-5 ring-1 ring-inset ring-emerald-950">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-4">
              What gets documented per surgery
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                "Pre-op diagnosis",
                "Procedure & surgeon",
                "Anaesthesia type",
                "Post-op findings",
                "Complications noted",
                "Operative images",
                "Discharge instructions",
                "Follow-up date",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="text-[13px] text-emerald-100/80">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] text-emerald-300/60 border-t border-emerald-800 pt-3">
              Generates a printable operative report — same structure every time.
            </p>
          </div>
        }
      >
        <div className="relative">
          <Reveal>
            <Frame
              src={`${IMG}/surgery-operative-report.jpg`}
              alt="A structured surgery operative report template showing pre-operative diagnosis, procedure and clinical findings"
              aspect="aspect-[3/4]"
              sizes="(max-width: 1024px) 92vw, 46vw"
              quality={85}
              radius="2.25rem"
            />
          </Reveal>
          <div className="ppms-float pointer-events-none absolute -bottom-10 -right-3 hidden w-[42%] lg:block">
            <Reveal delay={0.14}>
              <Frame
                src={`${IMG}/neuro-imaging-analysis-screen.jpg`}
                alt="A radiologist reviewing neuro-imaging analysis with region-of-interest findings on a diagnostic workstation"
                aspect="aspect-[2/3]"
                sizes="20vw"
                radius="1.5rem"
                className="shadow-[0_40px_70px_-35px_rgba(6,60,45,0.5)]"
              />
            </Reveal>
          </div>
        </div>
      </Split>
  );
}

function AnalyticsPanel() {
  return (
      <Split
        flip
        title={<>The numbers you actually run the practice on.</>}
        lede="Today's queue, this month's revenue by hospital, no-show rate, repeat-visit rate, computed from the same records your staff are already entering, so there is no separate reporting exercise."
        points={[
          {
            icon: <ChartNoAxesColumn size={17} strokeWidth={1.25} />,
            label: "Revenue by hospital and by month",
            desc: "Split per site or combined, with collections and outstanding shown separately.",
          },
          {
            icon: <Activity size={17} strokeWidth={1.25} />,
            label: "Operational load at a glance",
            desc: "Queue length, average consultation time and cancellations for each working day.",
          },
          {
            icon: <Database size={17} strokeWidth={1.25} />,
            label: "Exportable, always",
            desc: "Any view can be exported for your accountant or your own spreadsheet.",
          },
        ]}
        extras={
          <div className="rounded-2xl bg-white ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_20px_50px_-40px_rgba(6,60,45,0.25)] overflow-hidden">
            <div className="border-b border-emerald-950/[0.06] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Metrics tracked automatically
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-emerald-950/[0.05]">
              {[
                { icon: <Users size={14} strokeWidth={1.25} />, label: "Daily OPD volume", sub: "Per hospital, per day" },
                { icon: <ChartNoAxesColumn size={14} strokeWidth={1.25} />, label: "Revenue & collections", sub: "By site or combined" },
                { icon: <Activity size={14} strokeWidth={1.25} />, label: "No-show & cancel rate", sub: "Trended over 90 days" },
                { icon: <CalendarRange size={14} strokeWidth={1.25} />, label: "Repeat visit rate", sub: "Patient return frequency" },
              ].map((m) => (
                <div key={m.label} className="flex items-start gap-3 bg-white px-4 py-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/[0.12]">
                    {m.icon}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold leading-snug text-emerald-950">{m.label}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{m.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-emerald-950/[0.06] bg-emerald-50/50 px-5 py-3">
              <Check size={13} strokeWidth={2} className="text-emerald-600" aria-hidden="true" />
              <p className="text-[12.5px] text-slate-600">
                Exports to <span className="font-medium text-emerald-900">CSV or PDF</span> — no separate reporting setup required.
              </p>
            </div>
          </div>
        }
      >
        <div className="relative">
          <Reveal>
            <Frame
              src={`${IMG}/clinician-analytics-wall.jpg`}
              alt="A doctor reviewing practice analytics charts on a large transparent display"
              aspect="aspect-[2/3]"
              sizes="(max-width: 1024px) 92vw, 46vw"
              quality={82}
              radius="2.25rem"
            />
          </Reveal>
          <div className="ppms-float-slow pointer-events-none absolute -bottom-10 -left-3 hidden w-[40%] lg:block">
            <Reveal delay={0.14}>
              <Frame
                src={`${IMG}/printed-clinical-reports.jpg`}
                alt="Printed clinical summary reports and charts beside a stethoscope"
                aspect="aspect-[3/4]"
                sizes="20vw"
                radius="1.5rem"
                className="shadow-[0_40px_70px_-35px_rgba(6,60,45,0.5)]"
              />
            </Reveal>
          </div>
        </div>
      </Split>
  );
}

/* ═══ Content ══════════════════════════════════════════════════════════════ */

const CAPABILITIES = [
  "Appointments", "Electronic medical records", "Prescriptions", "Multi-hospital switching",
  "Billing & invoicing", "Insurance claims", "Patient timeline", "Surgery scheduling",
  "Lab & imaging results", "Leave management", "Role-based access", "Audit logs",
  "Daily backups", "Analytics dashboard",
];

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Can one doctor really work across several hospitals in one account?",
    a: "Yes, that is the core of RF Health. You sign in once and switch hospitals from a single control, and the patient record travels with you. Each hospital keeps its own schedule, billing and staff roles, while the clinical history stays unified under the patient.",
  },
  {
    q: "What happens to our existing patient records?",
    a: "Records can be imported from spreadsheets or an existing system during onboarding. Anything already captured on paper can be attached to a patient as a scanned document, and text is extracted so it becomes searchable alongside typed notes.",
  },
  {
    q: "Is the 7-day free trial limited in any way?",
    a: "The trial gives full access to the platform for 7 days. No card is required to start, and nothing is charged when the trial ends — you choose whether to continue.",
  },
  {
    q: "Who can see a patient's record?",
    a: "Access is role-based, not blanket. Doctors, front desk, billing and administrators each see only the parts of a record their role requires, and every view and edit is written to an audit log that administrators can review.",
  },
  {
    q: "Does RF Health work on a phone or tablet at the bedside?",
    a: "Yes. The console is responsive and designed for touch, so a tablet at the bedside or a phone between consultations works the same as a desktop at the front desk. There is nothing to install.",
  },
  {
    q: "What if we need an integration you do not have yet?",
    a: "Enterprise plans include custom integrations, and we will scope the work with you before you commit. Talk to us about the systems you already run, labs, imaging, pharmacy or accounting, and we will tell you honestly what is and is not feasible.",
  },
];

const PLANS = [
  {
    name: "Monthly",
    tag: "Individual doctors",
    price: "₹1,299",
    period: "/month",
    discount: "First month: 75% OFF",
    features: [
      "1 doctor account",
      "Unlimited hospitals",
      "Appointments & EMR",
      "Prescriptions & billing",
      "Email support",
    ],
    cta: "Start 7-day free trial",
    featured: false,
  },
  {
    name: "5 Doctors",
    tag: "Clinics & groups",
    price: "₹2,999",
    period: "/month",
    discount: "First month: 75% OFF",
    features: [
      "Up to 5 doctor logins",
      "Unlimited hospitals",
      "Full EMR & prescriptions",
      "Advanced billing & insurance",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Start 7-day free trial",
    featured: true,
  },
  {
    name: "Yearly",
    tag: "Best value",
    price: "₹9,999",
    period: "/year",
    discount: null,
    features: [
      "Everything in 5 Doctors",
      "Unlimited hospitals",
      "Annual billing — save 2 months",
      "Priority support",
      "Dedicated onboarding",
    ],
    cta: "Start 7-day free trial",
    featured: false,
  },
];

/* ═══ Page ═════════════════════════════════════════════════════════════════ */

export function PremiumLanding() {
  return (
    <div
      id="top"
      className="ppms-landing font-body min-h-screen bg-white text-emerald-950 antialiased"
    >
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* From 1920px up the hero claims the first screen and centres its own
          content in it. Below that it stays exactly as authored: the height is
          content-driven, which is what keeps a 900px-tall laptop from having to
          scroll past a deliberately empty band. svh rather than vh so a mobile
          URL bar can never make it taller than the visible area. */}
      {/* The hero is content-driven at every width. It briefly carried
          4xl:min-h-svh so it would claim the whole first screen, but on a
          2160px-tall display that forced 837px of empty band around 1323px of
          content, which is the opposite of filling the screen. Letting the
          next section peek in also tells the reader there is more. */}
      <section className={`lp-hero relative overflow-hidden ${GUTTER} pb-10 pt-24 sm:pb-12 sm:pt-28 lg:pb-14 lg:pt-28`}>
        {/* Two soft emerald orbs, well below the content — the only colour in the
            page background. Fixed-size, blurred once, never animated. */}
        <div
          aria-hidden="true"
          className="ppms-orb-a pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-emerald-200/30 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="ppms-orb-b pointer-events-none absolute -right-52 top-40 h-[620px] w-[620px] rounded-full bg-teal-100/50 blur-[130px]"
        />

        <div className={`relative grid w-full items-center gap-10 sm:gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 4xl:gap-20 ${SHELL}`}>
          <div>
            <Reveal y={20}>
              <Eyebrow>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
                </span>
                Practice management platform
              </Eyebrow>
            </Reveal>

            <Reveal y={34} delay={0.06}>
              {/* "Every hospital." is the widest line and sets the floor: at
                  320px it has to fit 288px of usable width. */}
              <h1 className="font-display mt-5 text-[length:var(--lp-h1)] font-bold leading-[1.03] tracking-[-0.035em] text-emerald-950 sm:mt-6">
                One doctor.
                <br />
                Every hospital.
                <br />
                <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  One record.
                </span>
              </h1>
            </Reveal>

            <Reveal y={24} delay={0.14}>
              <p className="mt-5 max-w-xl 2xl:max-w-[680px] 4xl:max-w-[760px] 5xl:max-w-[880px] 6xl:max-w-[1040px] text-[length:var(--lp-lede-hero)] leading-relaxed text-slate-600 sm:mt-6">
                Appointments, medical records, prescriptions, surgery and billing across every
                hospital you practise at, managed from a single secure account, with the patient
                history following the patient rather than the building.
              </p>
            </Reveal>

            <Reveal y={20} delay={0.22}>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Magnetic
                  href="/login"
                  className="group inline-flex items-center justify-between gap-3 rounded-full bg-emerald-950 py-2 pl-7 pr-2 text-[15px] font-semibold text-white shadow-[0_20px_40px_-20px_rgba(6,60,45,0.6)]"
                >
                  Start 7-day free trial
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[3px] group-hover:-translate-y-[2px] group-hover:scale-105">
                    <ArrowUpRight size={17} strokeWidth={1.25} aria-hidden="true" />
                  </span>
                </Magnetic>

                <a
                  href="#contact"
                  className="group inline-flex items-center justify-between gap-3 rounded-full border border-emerald-950/[0.1] py-2 pl-7 pr-2 text-[15px] font-medium text-emerald-950 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-emerald-50"
                >
                  Book a demo
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-950/[0.05] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[3px] group-hover:-translate-y-[2px] group-hover:scale-105">
                    <ArrowUpRight size={17} strokeWidth={1.25} aria-hidden="true" />
                  </span>
                </a>
              </div>
            </Reveal>

            <Reveal y={16} delay={0.3}>
              <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13.5px] text-slate-500">
                {["No credit card", "Set up in minutes", "Cancel anytime"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check size={14} strokeWidth={1.75} className="text-emerald-600" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Z-axis cascade: the main plate, with a second smaller plate breaking
              its lower-left corner. Overlap is removed below lg. */}
          <Reveal y={40} delay={0.1} className="relative">
            <Frame
              src={`${IMG}/hero-clinician-tablet-dashboard.jpg`}
              alt="A clinician in gloves reviewing a RF Health patient dashboard on a tablet in a hospital corridor"
              // Portrait on mobile, where the plate is full width and tall is
              // correct. From lg it relaxes, because that is where the copy
              // sits beside it: held at 3/4 the plate ran 765px against a
              // 528px text column, and items-center split the 236px difference
              // above and below the headline. Squaring it at lg brings the two
              // columns within ~50px of each other. The frame crops with
              // object-cover, so this trims the photo rather than distorting it.
              aspect="aspect-[3/4] lg:aspect-[1/1] 4xl:aspect-[5/4] 5xl:aspect-[4/3]"
              sizes="(max-width: 1024px) 92vw, 46vw"
              priority
              quality={85}
              radius="2.25rem"
            />
            <div className="ppms-float pointer-events-none absolute -bottom-10 -left-6 hidden w-[46%] lg:block">
              <Frame
                src={`${IMG}/laptop-holographic-practice-dashboard.jpg`}
                alt="Practice analytics projected above a laptop screen"
                aspect="aspect-square"
                sizes="22vw"
                radius="1.5rem"
                className="shadow-[0_40px_70px_-35px_rgba(6,60,45,0.5)]"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Social proof numbers ─────────────────────────────────────────── */}
      <Section className="lp-tight-top pt-8 md:pt-10 lg:pt-12">
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14">
            {[
              { num: "500+", label: "Doctors on the platform" },
              { num: "100+", label: "Hospitals & clinics" },
              { num: "99.9%", label: "Uptime target" },
              { num: "7-day", label: "Free trial, no card" },
            ].map((s, i) => (
              <div key={s.label} className={`text-center ${i < 3 ? "sm:border-r sm:border-emerald-950/[0.07] sm:pr-10 sm:last:border-0" : ""}`}>
                <p className="font-display text-[clamp(1.6rem,3vw,2.25rem)] font-bold leading-none tracking-[-0.03em] text-emerald-950">
                  {s.num}
                </p>
                <p className="mt-1.5 text-[13px] text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* ── What's included (capability marquee) ─────────────────────────── */}
      <Section className="lp-tight-top pt-0 md:pt-0 lg:pt-0">
        <Reveal>
          <p className="text-center text-[13px] font-medium uppercase tracking-[0.18em] text-slate-400">
            From first appointment to invoice — every module included
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <Marquee items={CAPABILITIES} className="mt-7" />
        </Reveal>
      </Section>

      {/* ── EMR ──────────────────────────────────────────────────────────── */}
      <Section id="emr" className="bg-gradient-to-b from-white via-slate-50/60 to-white">
        <Split
          eyebrow="Electronic medical records"
          title={<>Notes that stay legible five years later.</>}
          lede="Structured consultation notes with vitals, diagnosis, investigations and plan, captured in the room, not written up afterwards from memory."
          points={[
            {
              icon: <ClipboardPlus size={17} strokeWidth={1.25} />,
              label: "Templates per specialty",
              desc: "Start from a template that matches how you actually examine, then edit freely.",
            },
            {
              icon: <History size={17} strokeWidth={1.25} />,
              label: "Full patient timeline",
              desc: "Every visit, prescription and result on one scrollable thread.",
            },
            {
              icon: <ScanLine size={17} strokeWidth={1.25} />,
              label: "Scanned reports become searchable",
              desc: "Upload an outside lab report and its text is extracted and indexed with the record.",
            },
          ]}
        >
          <div className="relative">
            <Reveal>
              <Frame
                src={`${IMG}/emr-records-tablet.jpg`}
                alt="A doctor reviewing a list of electronic medical records on a tablet"
                aspect="aspect-[4/5] lg:aspect-[1/1] 4xl:aspect-[5/4]"
                sizes="(max-width: 1024px) 92vw, 46vw"
                quality={82}
                radius="2.25rem"
              />
            </Reveal>
            <div className="ppms-float pointer-events-none absolute -bottom-10 -right-3 hidden w-[42%] lg:block">
              <Reveal delay={0.14}>
                <Frame
                  src={`${IMG}/clinician-holographic-chart.jpg`}
                  alt="A clinician examining a patient's anatomical chart on a large clinical display"
                  aspect="aspect-[2/3]"
                  sizes="20vw"
                  radius="1.5rem"
                  className="shadow-[0_40px_70px_-35px_rgba(6,60,45,0.5)]"
                />
              </Reveal>
            </div>
          </div>
        </Split>
      </Section>

      {/* ── Clinical AI ──────────────────────────────────────────────────────
          Copy here is held to what the Clinical Copilot plugin actually does,
          per its manifest: summarise, ask, draft, all gated by role. The
          "never writes to the record" line is a real product constraint, not
          a reassurance -- drafts return for review and are saved by the
          doctor, and the plugin is off by default even for hospital admins.
          If the plugin's capabilities change, this section changes with it. */}
      <Section id="copilot">
        <SectionHead
          eyebrow="Clinical AI"
          title={<>A second read of the chart, before you walk in.</>}
          lede="The Clinical Copilot reads the record you already keep and gives it back to you as something shorter. It drafts, it does not decide, and everything it produces is yours to accept or discard."
        />

        <RevealGroup
          className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 2xl:grid-cols-4"
          stagger={0.06}
        >
          {[
            {
              icon: <ScanLine size={19} strokeWidth={1.25} />,
              title: "Summarise the record",
              body: "History, medications, investigations and the visit timeline condensed into a brief you can read before the patient sits down.",
            },
            {
              icon: <MessageSquareText size={19} strokeWidth={1.25} />,
              title: "Ask it questions",
              body: "Ask what changed since the last visit, or when a drug was started, and get an answer drawn from that patient’s own chart.",
            },
            {
              icon: <ClipboardPlus size={19} strokeWidth={1.25} />,
              title: "Draft the consultation note",
              body: "A first draft of the note, returned for review. Nothing reaches the record until you have read it and saved it yourself.",
            },
            {
              icon: <ShieldCheck size={19} strokeWidth={1.25} />,
              title: "Granted, never inherited",
              body: "Off by default, including for hospital administrators. A doctor grants access deliberately, and it stays inside the same role and audit rules as the rest of the record.",
            },
          ].map((c) => (
            <RevealItem key={c.title}>
              <div className="group/ai h-full rounded-[1.5rem] bg-white p-2 ring-1 ring-inset ring-emerald-950/[0.07] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-[0_24px_50px_-38px_rgba(6,60,45,0.5)]">
                <div className="flex h-full flex-col gap-4 rounded-[1rem] bg-gradient-to-b from-slate-50/80 to-white p-6 3xl:p-8 4xl:p-10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/ai:scale-110">
                    {c.icon}
                  </span>
                  <h3 className="text-[16.5px] font-semibold leading-snug tracking-[-0.01em] text-emerald-950">
                    {c.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-slate-600">{c.body}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2 text-center text-[13.5px] leading-relaxed text-slate-500">
            <Sparkles size={15} strokeWidth={1.25} className="shrink-0 text-emerald-600" aria-hidden="true" />
            Decision support, not diagnosis. The Copilot assists the doctor reading the chart; it never replaces that reading.
          </p>
        </Reveal>
      </Section>


      {/* ── Patient journey · Surgery · Analytics (tabbed) ───────────────────
          Three former sections in one. Only the active panel mounts, so this
          costs the height of one section instead of three. */}
      <Section className="bg-gradient-to-b from-white via-emerald-50/40 to-white">
        <WorkflowTabs
          tabs={[
            { id: "journey",   label: "Patient Journey",  content: <JourneyPanel /> },
            { id: "surgery",   label: "Surgery Workflow", content: <SurgeryPanel /> },
            { id: "analytics", label: "Analytics",        content: <AnalyticsPanel /> },
          ]}
        />
      </Section>


      {/* ── Security (condensed) ─────────────────────────────────────────── */}
      <Section id="security">
        <SectionHead
          eyebrow="Security"
          title={<>Built to be defensible, not just encrypted.</>}
          lede="Patient data carries obligations. RF Health is designed so that who saw what, and when, is always answerable, and so that access is granted by role rather than by trust."
        />

        <Reveal delay={0.08}>
          <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-3">
            {[
              { icon: <Lock size={15} strokeWidth={1.25} />, label: "Encrypted in transit & at rest" },
              { icon: <ShieldCheck size={15} strokeWidth={1.25} />, label: "Role-based access control" },
              { icon: <History size={15} strokeWidth={1.25} />, label: "Immutable audit log" },
              { icon: <Fingerprint size={15} strokeWidth={1.25} />, label: "Two-factor authentication" },
              { icon: <Cloud size={15} strokeWidth={1.25} />, label: "Redundant cloud hosting" },
              { icon: <Database size={15} strokeWidth={1.25} />, label: "Automated daily backups" },
              { icon: <BadgeCheck size={15} strokeWidth={1.25} />, label: "HIPAA-aligned design" },
              { icon: <Activity size={15} strokeWidth={1.25} />, label: "Session & device visibility" },
            ].map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13.5px] font-medium text-emerald-900 ring-1 ring-inset ring-emerald-950/[0.07]"
              >
                <span className="text-emerald-600">{s.icon}</span>
                {s.label}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] leading-relaxed text-slate-400">
            HIPAA-aligned design describes how the platform is built — access control, audit logging and encryption. It is not a certification claim.
          </p>
        </Reveal>
      </Section>


      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Section id="pricing">
        <SectionHead
          eyebrow="Pricing"
          title={<>Priced per practice, not per patient.</>}
          lede="Start with a 7-day free trial — no card required. First month 75% off on Monthly and 5 Doctors plans."
        />
        <Reveal>
          <div className="mx-auto mt-4 flex w-max items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 ring-1 ring-inset ring-emerald-600/[0.15]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[13px] font-semibold text-emerald-800">7-Day Free Trial — no credit card required</span>
          </div>
        </Reveal>

        {/* Three-up from md — stacking full-width plan cards on a 768px tablet
            wastes the width and pushes the comparison off-screen. */}
        <RevealGroup
          className="mt-8 grid items-stretch gap-4 sm:mt-10 md:grid-cols-3 2xl:mx-auto 2xl:max-w-[1500px] 5xl:max-w-[1880px] 6xl:max-w-[2400px]"
          stagger={0.08}
        >
          {PLANS.map((p) => (
            <RevealItem key={p.name} className="h-full">
              <div
                className={[
                  "flex h-full flex-col rounded-[2rem] p-2 ring-1 ring-inset",
                  "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5",
                  p.featured
                    ? "bg-emerald-950 ring-emerald-950 shadow-[0_40px_80px_-50px_rgba(6,60,45,0.9)]"
                    : "bg-white ring-emerald-950/[0.07] hover:shadow-[0_30px_60px_-42px_rgba(6,60,45,0.5)]",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-full flex-col rounded-[1.5rem] p-6 md:p-5 lg:p-7",
                    p.featured
                      ? "bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                      : "bg-gradient-to-b from-slate-50/70 to-white",
                  ].join(" ")}
                >
                  {p.featured && (
                    <span className="mb-5 inline-flex w-max items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                      Most popular
                    </span>
                  )}
                  <h3
                    className={`font-display text-[22px] font-bold tracking-[-0.02em] ${
                      p.featured ? "text-white" : "text-emerald-950"
                    }`}
                  >
                    {p.name}
                  </h3>
                  <p className={`mt-1.5 text-[13.5px] ${p.featured ? "text-emerald-200/60" : "text-slate-500"}`}>
                    {p.tag}
                  </p>

                  <div className="mt-6 sm:mt-8">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={`font-display text-[clamp(2rem,3.2vw,2.5rem)] 2xl:text-[clamp(2.5rem,2.2vw,3.25rem)] font-bold tracking-[-0.03em] ${
                          p.featured ? "text-white" : "text-emerald-950"
                        }`}
                      >
                        {p.price}
                      </span>
                      <span className={`text-[13.5px] ${p.featured ? "text-emerald-200/60" : "text-slate-500"}`}>
                        {p.period}
                      </span>
                    </div>
                    {p.discount && (
                      <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        p.featured
                          ? "bg-emerald-400/20 text-emerald-300"
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/[0.15]"
                      }`}>
                        {p.discount}
                      </span>
                    )}
                  </div>

                  <ul className="mt-8 flex flex-1 flex-col gap-3.5">
                    {p.features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-start gap-3 text-[14px] leading-snug ${
                          p.featured ? "text-emerald-50/85" : "text-slate-600"
                        }`}
                      >
                        <Check
                          size={15}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className={`mt-0.5 shrink-0 ${p.featured ? "text-emerald-400" : "text-emerald-600"}`}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="/login"
                    className={[
                      /* Tight at md, where three cards share a 768px row, then
                         back to full size once there is room again. */
                      "group mt-8 flex items-center justify-between gap-2 rounded-full py-2 pl-5 pr-1.5 text-[13.5px] font-semibold",
                      "md:pl-4 lg:mt-9 lg:gap-3 lg:pl-6 lg:pr-2 lg:text-[14.5px]",
                      "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]",
                      p.featured
                        ? "bg-white text-emerald-950"
                        : "bg-emerald-950 text-white",
                    ].join(" ")}
                  >
                    <span className="whitespace-nowrap">{p.cta}</span>
                    <span
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full lg:h-9 lg:w-9",
                        "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:scale-105",
                        p.featured ? "bg-emerald-950/8" : "bg-white/12",
                      ].join(" ")}
                    >
                      <ArrowUpRight size={15} strokeWidth={1.25} aria-hidden="true" />
                    </span>
                  </a>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section id="faq" className="bg-gradient-to-b from-white via-slate-50/60 to-white">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display mt-5 text-[clamp(1.6rem,5.4vw,2.625rem)] 2xl:text-[clamp(2.625rem,2.3vw,3.4rem)] font-bold leading-[1.07] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-6">
              Questions we get asked before the first demo.
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-slate-600">
              If yours is not here, ask it directly, we would rather answer honestly up front than
              discover a mismatch after onboarding.
            </p>
            <a
              href="mailto:support@ppmsai.com"
              className="mt-8 inline-flex items-center gap-2 text-[14.5px] font-semibold text-emerald-700 underline-offset-4 hover:underline"
            >
              <Mail size={15} strokeWidth={1.25} aria-hidden="true" />
              support@ppmsai.com
            </a>
          </Reveal>

          <Reveal delay={0.08}>
            <Faq items={FAQ_ITEMS} />
          </Reveal>
        </div>
      </Section>

      {/* ── Book a Free Demo ─────────────────────────────────────────────── */}
      <Section id="contact" className="bg-gradient-to-b from-slate-50/60 via-white to-white">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16 xl:gap-20">

          {/* Left — value prop */}
          <Reveal className="lg:sticky lg:top-28">
            <Eyebrow>Free Demo</Eyebrow>
            <h2 className="font-display mt-5 text-[length:var(--lp-h2-split)] font-bold leading-[1.07] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-6">
              See How RF Health Can Transform Your Practice
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-slate-600">
              Book a free, personalised demo with our team. We will walk you through
              RF Health features, discuss your specific practice requirements and show you
              how it fits into your day-to-day workflow, no commitment required.
            </p>

            <ul className="mt-8 flex flex-col gap-3.5">
              {[
                { icon: <CheckCircle2 size={16} strokeWidth={1.5} />, label: "Free personalised demo", desc: "A live walkthrough tailored to your specialty and practice size." },
                { icon: <Users size={16} strokeWidth={1.5} />, label: "Discuss your requirements", desc: "Tell us how you work, we will show you how RF Health adapts to it." },
                { icon: <Stethoscope size={16} strokeWidth={1.5} />, label: "Features & workflows", desc: "EMR, appointments, prescriptions, surgery notes, billing and more." },
                { icon: <BadgeCheck size={16} strokeWidth={1.5} />, label: "Implementation guidance", desc: "Understand onboarding, data migration and go-live timelines." },
              ].map((p) => (
                <li key={p.label} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-900/[0.07]">
                    {p.icon}
                  </span>
                  <div>
                    <p className="text-[14.5px] font-semibold text-emerald-950">{p.label}</p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-500">{p.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

          </Reveal>

          {/* Right — form */}
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(6,60,45,0.08)] sm:p-8 3xl:p-10 4xl:p-12">
              <p className="mb-5 text-[13px] font-semibold uppercase tracking-[0.15em] text-emerald-700">
                Book a Free Demo
              </p>
              <DemoForm />
            </div>
          </Reveal>
        </div>
      </Section>


      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className={`border-t border-emerald-950/[0.07] ${GUTTER} py-10 sm:py-12`}>
        <div className={`grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr] ${SHELL}`}>
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/landing/logo-rf-health.webp"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-emerald-950/[0.08]"
              />
              <span className="font-display text-[16px] font-bold tracking-tight text-emerald-950">
                RF Health
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-slate-500">
              Patient practice management for doctors working across multiple hospitals. A product
              of RAPDFLY PRIVATE LIMITED.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 text-[13.5px] text-slate-500">
              <a href="mailto:support@ppmsai.com" className="flex items-center gap-2 hover:text-emerald-800">
                <Mail size={14} strokeWidth={1.25} aria-hidden="true" />
                support@ppmsai.com
              </a>
              <a href="tel:+917373351087" className="flex items-center gap-2 hover:text-emerald-800">
                <Phone size={14} strokeWidth={1.25} aria-hidden="true" />
                +91 73733 51087
              </a>
              <span className="flex items-center gap-2">
                <MapPin size={14} strokeWidth={1.25} aria-hidden="true" />
                Bangalore, Karnataka
              </span>
              <a
                href="https://www.linkedin.com/company/rapdfly"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-emerald-800"
              >
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                LinkedIn
              </a>
            </div>
          </div>

          {[
            { h: "Platform", links: [["Overview", "#platform"], ["Medical records", "#emr"], ["Multi-hospital", "#hospitals"], ["Surgery", "#surgery"]] },
            { h: "Resources", links: [["Analytics", "#analytics"], ["Security", "#security"], ["Pricing", "#pricing"], ["FAQ", "#faq"]] },
            { h: "Get started", links: [["Sign in", "/login"], ["Free trial", "/login"], ["Book a demo", "#contact"], ["Contact", "mailto:support@ppmsai.com"]] },
          ].map((col) => (
            <div key={col.h}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-950">
                {col.h}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[14px] text-slate-500 transition-colors duration-300 hover:text-emerald-800"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={`mt-10 flex flex-col gap-3 border-t border-emerald-950/[0.07] pt-6 text-[13px] text-slate-400 sm:flex-row sm:items-center sm:justify-between ${SHELL}`}>
          <p>© {new Date().getFullYear()} RAPDFLY PRIVATE LIMITED. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors duration-300 hover:text-emerald-800">
              Privacy Policy
            </Link>
            <span>ppmsai.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
