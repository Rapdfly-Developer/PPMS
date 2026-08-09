import Image from "next/image";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarRange,
  ChartNoAxesColumn,
  Check,
  ClipboardPlus,
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
import { Nav } from "./Nav";
import { Counter, Magnetic, Marquee, Parallax, Reveal, RevealGroup, RevealItem } from "./ui";

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
 * One measure for the whole page. Capped at 6xl through desktop so line length
 * stays readable, then allowed to grow on very wide displays — at 2560px a
 * 1152px column reads as a ribbon stranded in white space.
 */
const SHELL = "mx-auto w-full max-w-6xl xl:max-w-[1240px] 2xl:max-w-[1360px] 3xl:max-w-[1520px]";

/** Horizontal gutter, shared by Section, the hero and the footer so all three
 *  edges line up at every width. */
const GUTTER = "px-4 sm:px-6 lg:px-8 2xl:px-10";

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
      className={`scroll-mt-24 sm:scroll-mt-28 ${GUTTER} py-20 sm:py-24 md:py-32 lg:py-40 ${className}`}
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
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  align?: "center" | "left";
}) {
  return (
    <Reveal className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      {/* Fluid between 320px and ~1536px, then pinned — clamp keeps the headline
          inside a 320px viewport without a stack of breakpoint overrides. */}
      <h2 className="font-display mt-5 text-[clamp(1.75rem,6.2vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-6">
        {title}
      </h2>
      {lede && (
        <p className="mt-5 text-[clamp(0.95rem,1.6vw,1.03rem)] leading-relaxed text-slate-600 sm:mt-6">
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
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  points: { icon: React.ReactNode; label: string; desc: string }[];
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
      <div className={flip ? "lg:order-2" : ""}>
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="font-display mt-5 text-[clamp(1.6rem,5.4vw,3rem)] font-bold leading-[1.07] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-6">
            {title}
          </h2>
          <p className="mt-5 text-[clamp(0.95rem,1.6vw,1.03rem)] leading-relaxed text-slate-600 sm:mt-6">
            {lede}
          </p>
        </Reveal>

        <RevealGroup className="mt-8 flex flex-col gap-1 sm:mt-10" stagger={0.07} delayChildren={0.1}>
          {points.map((p) => (
            <RevealItem key={p.label}>
              <div className="flex gap-3.5 rounded-2xl px-3 py-4 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-emerald-50/70 sm:gap-4 sm:px-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_1px_2px_rgba(6,60,45,0.05)]">
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
      </div>

      <div className={flip ? "lg:order-1" : ""}>{children}</div>
    </div>
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
    a: "Yes — that is the core of PPMS. You sign in once and switch hospitals from a single control, and the patient record travels with you. Each hospital keeps its own schedule, billing and staff roles, while the clinical history stays unified under the patient.",
  },
  {
    q: "What happens to our existing patient records?",
    a: "Records can be imported from spreadsheets or an existing system during onboarding. Anything already captured on paper can be attached to a patient as a scanned document, and text is extracted so it becomes searchable alongside typed notes.",
  },
  {
    q: "Is the 30-day trial limited in any way?",
    a: "The trial gives one doctor account and up to two hospitals, with appointments, EMR and basic billing enabled. No card is required to start, and nothing is charged when the trial ends — you choose whether to continue.",
  },
  {
    q: "Who can see a patient's record?",
    a: "Access is role-based, not blanket. Doctors, front desk, billing and administrators each see only the parts of a record their role requires, and every view and edit is written to an audit log that administrators can review.",
  },
  {
    q: "Does PPMS work on a phone or tablet at the bedside?",
    a: "Yes. The console is responsive and designed for touch, so a tablet at the bedside or a phone between consultations works the same as a desktop at the front desk. There is nothing to install.",
  },
  {
    q: "What if we need an integration you do not have yet?",
    a: "Enterprise plans include custom integrations, and we will scope the work with you before you commit. Talk to us about the systems you already run — labs, imaging, pharmacy or accounting — and we will tell you honestly what is and is not feasible.",
  },
];

const TESTIMONIALS = [
  {
    name: "Dr. Aravind Patel",
    role: "Ophthalmologist · 3 hospitals",
    text: "PPMS transformed how I manage my three eye care centres. One login, all patient records, seamless billing — I save two hours every single day.",
  },
  {
    name: "Dr. Meera Krishnan",
    role: "General physician · 2 clinics",
    text: "The multi-hospital switching is flawless. My patients get consistent care records whether they visit me at the hospital or my private clinic.",
  },
  {
    name: "Sundar Rajan",
    role: "Hospital administrator",
    text: "Staff onboarded in a day. Reports that used to take hours now generate in seconds. PPMS is enterprise-grade at an accessible price.",
  },
];

const PLANS = [
  {
    name: "Starter",
    tag: "Individual doctors",
    price: "Free",
    period: "30-day trial",
    features: ["1 doctor account", "Up to 2 hospitals", "Appointments & EMR", "Basic billing", "Email support"],
    cta: "Start free trial",
    featured: false,
  },
  {
    name: "Professional",
    tag: "Clinics & groups",
    price: "₹2,999",
    period: "/month",
    features: [
      "Up to 5 doctors",
      "Unlimited hospitals",
      "Full EMR & prescriptions",
      "Advanced billing & insurance",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Enterprise",
    tag: "Hospitals & chains",
    price: "Custom",
    period: "pricing",
    features: [
      "Unlimited doctors",
      "Unlimited hospitals",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "On-premise option",
    ],
    cta: "Talk to sales",
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
      <section className={`relative overflow-hidden ${GUTTER} pb-20 pt-28 sm:pb-24 sm:pt-36 lg:pb-32 lg:pt-44`}>
        {/* Two soft emerald orbs, well below the content — the only colour in the
            page background. Fixed-size, blurred once, never animated. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-emerald-200/30 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-52 top-40 h-[620px] w-[620px] rounded-full bg-teal-100/50 blur-[130px]"
        />

        <div className={`relative grid items-center gap-12 sm:gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 ${SHELL}`}>
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
              <h1 className="font-display mt-6 text-[clamp(2.1rem,8.6vw,4.25rem)] font-bold leading-[1.03] tracking-[-0.035em] text-emerald-950 sm:mt-7">
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
              <p className="mt-6 max-w-xl text-[clamp(0.98rem,1.7vw,1.06rem)] leading-relaxed text-slate-600 sm:mt-8">
                Appointments, medical records, prescriptions, surgery and billing across every
                hospital you practise at — managed from a single secure account, with the patient
                history following the patient rather than the building.
              </p>
            </Reveal>

            <Reveal y={20} delay={0.22}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Magnetic
                  href="/login"
                  className="group inline-flex items-center justify-between gap-3 rounded-full bg-emerald-950 py-2 pl-7 pr-2 text-[15px] font-semibold text-white shadow-[0_20px_40px_-20px_rgba(6,60,45,0.6)]"
                >
                  Start 30-day free trial
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[3px] group-hover:-translate-y-[2px] group-hover:scale-105">
                    <ArrowUpRight size={17} strokeWidth={1.25} aria-hidden="true" />
                  </span>
                </Magnetic>

                <a
                  href="#contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-950/[0.1] px-7 py-4 text-[15px] font-medium text-emerald-950 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-emerald-50"
                >
                  Book a demo
                </a>
              </div>
            </Reveal>

            <Reveal y={16} delay={0.3}>
              <ul className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-[13.5px] text-slate-500">
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
              alt="A clinician in gloves reviewing a PPMS patient dashboard on a tablet in a hospital corridor"
              aspect="aspect-[3/4]"
              sizes="(max-width: 1024px) 92vw, 46vw"
              priority
              quality={85}
              radius="2.25rem"
            />
            <div className="pointer-events-none absolute -bottom-10 -left-6 hidden w-[46%] lg:block">
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

      {/* ── Trusted by hospitals ─────────────────────────────────────────── */}
      <Section className="pt-8 md:pt-10 lg:pt-12">
        <Reveal>
          <p className="text-center text-[13px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Trusted by hospitals, clinics and independent practitioners
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <Marquee items={CAPABILITIES} className="mt-10" />
        </Reveal>

        <div className="mt-14 grid items-center gap-10 sm:mt-20 sm:gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-20">
          <Reveal>
            <Frame
              src={`${IMG}/gloved-hand-care-network.jpg`}
              alt="A gloved hand touching a connected network of hospital care services"
              aspect="aspect-square"
              sizes="(max-width: 1024px) 92vw, 38vw"
              radius="1.75rem"
            />
          </Reveal>

          <RevealGroup className="grid grid-cols-2 gap-x-5 gap-y-9 xs:gap-x-8 sm:gap-x-14 sm:gap-y-12">
            {[
              { to: 500, suffix: "+", label: "Doctors on the platform" },
              { to: 100, suffix: "+", label: "Hospitals & clinics" },
              { to: 100000, suffix: "+", label: "Patient records managed" },
              { to: 99.9, suffix: "%", label: "Uptime target", decimals: 1 },
            ].map((s) => (
              <RevealItem key={s.label} className="min-w-0">
                {/* "100,000+" is the long one — the lower clamp bound is set so
                    it still fits a half-column at 320px. */}
                <div className="font-display text-[clamp(1.6rem,6.4vw,2.875rem)] font-bold leading-none tracking-[-0.03em] text-emerald-950">
                  <Counter to={s.to} suffix={s.suffix} decimals={s.decimals ?? 0} />
                </div>
                <div className="mt-2 text-[13px] leading-snug text-slate-500 sm:text-[14px]">
                  {s.label}
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </Section>

      {/* ── The shift ────────────────────────────────────────────────────── */}
      <Section className="bg-gradient-to-b from-white via-emerald-50/40 to-white">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <Eyebrow>The shift</Eyebrow>
            <h2 className="font-display mt-5 text-[clamp(1.6rem,5.4vw,3rem)] font-bold leading-[1.07] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-6">
              Most practices still run on paper, phone calls and three unconnected systems.
            </h2>
            <p className="mt-6 text-[16.5px] leading-relaxed text-slate-600">
              A doctor working across three hospitals typically holds three logins, three schedules
              and three fragments of the same patient&apos;s history. Nothing is wrong with any one
              of them — the problem is that none of them can see the others.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                { k: "Before", v: "Three logins, three calendars, one patient split across all of them." },
                { k: "With PPMS", v: "One login, one calendar, one continuous record per patient." },
              ].map((row, i) => (
                <div
                  key={row.k}
                  className={[
                    "rounded-2xl p-5 ring-1 ring-inset",
                    i === 0
                      ? "bg-slate-50 text-slate-500 ring-slate-950/[0.05]"
                      : "bg-emerald-950 text-emerald-50 ring-emerald-950",
                  ].join(" ")}
                >
                  <div
                    className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      i === 0 ? "text-slate-400" : "text-emerald-400"
                    }`}
                  >
                    {row.k}
                  </div>
                  <p className="mt-3 text-[14.5px] leading-relaxed">{row.v}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Parallax distance={26}>
            <Reveal delay={0.06}>
              <Frame
                src={`${IMG}/ai-modernizing-healthcare-poster.jpg`}
                alt="Illustration contrasting outdated manual healthcare paperwork with a modern intelligent patient-insights interface"
                aspect="aspect-[3/4]"
                sizes="(max-width: 1024px) 92vw, 46vw"
                quality={84}
              />
            </Reveal>
          </Parallax>
        </div>
      </Section>

      {/* ── Platform / features bento ────────────────────────────────────── */}
      <Section id="platform">
        <SectionHead
          eyebrow="The platform"
          title={
            <>
              Everything a practice runs on,
              <br className="hidden sm:block" /> in one place.
            </>
          }
          lede="Twelve modules that share a single patient record, a single calendar and a single permission model — so nothing has to be entered twice or reconciled later."
        />

        {/* 12 columns at every size from md up. The previous 6-column md track
            could not hold a 6-span plate beside a 3-span column, so the stacked
            column was orphaned at half width on tablets. */}
        <RevealGroup
          className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 md:grid-cols-12"
          stagger={0.06}
        >
          {/* Wide feature plate */}
          <RevealItem className="sm:col-span-2 md:col-span-7">
            <div className="group h-full overflow-hidden rounded-[2rem] bg-emerald-950 p-2 ring-1 ring-inset ring-emerald-950">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem]">
                <Image
                  src={`${IMG}/connected-patient-data-tablet.jpg`}
                  alt="A doctor holding a tablet with a connected web of patient data rising from the screen"
                  fill
                  sizes="(max-width: 768px) 92vw, 58vw"
                  quality={82}
                  className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
                />
              </div>
              <div className="px-6 pb-6 pt-7">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  <Database size={12} strokeWidth={1.25} aria-hidden="true" />
                  Unified record
                </div>
                <h3 className="font-display mt-4 text-[24px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[28px]">
                  One patient, one history — regardless of which hospital they walk into.
                </h3>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-emerald-100/70">
                  Consultations, prescriptions, lab results, admissions and invoices attach to the
                  patient, not to the site. Switching hospitals changes your schedule and your
                  billing context — never the clinical history.
                </p>
              </div>
            </div>
          </RevealItem>

          {/* Stacked right column */}
          <RevealItem className="sm:col-span-2 md:col-span-5">
            <div className="flex h-full flex-col gap-4">
              <div className="rounded-[2rem] bg-emerald-50/70 p-2 ring-1 ring-inset ring-emerald-950/[0.06]">
                <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem]">
                  <Image
                    src={`${IMG}/pharmacy-medication-infographic.jpg`}
                    alt="Gloved hands drawing medication from a vial beside a medical data overlay"
                    fill
                    sizes="(max-width: 768px) 92vw, 40vw"
                    quality={80}
                    className="object-cover"
                  />
                </div>
                <div className="px-5 pb-5 pt-6">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    <Pill size={12} strokeWidth={1.25} aria-hidden="true" />
                    Prescriptions
                  </div>
                  <h3 className="font-display mt-3 text-[19px] font-bold tracking-[-0.02em] text-emerald-950">
                    Prescribe once, print or share instantly.
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-600">
                    Dosage, duration and refills carry forward from the last visit, so repeat
                    prescriptions take a click rather than a re-type.
                  </p>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-5 rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_20px_50px_-40px_rgba(6,60,45,0.5)]">
                <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  <Image
                    src={`${IMG}/care-management-tile.jpg`}
                    alt="Care management concept tile"
                    fill
                    sizes="92px"
                    quality={78}
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-display text-[17px] font-bold tracking-[-0.02em] text-emerald-950">
                    Care management, end to end
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                    From the first appointment to discharge and follow-up — one thread, no handoff
                    gaps.
                  </p>
                </div>
              </div>
            </div>
          </RevealItem>

          {/* Icon row */}
          {[
            { icon: <CalendarRange size={18} strokeWidth={1.25} />, t: "Appointments", d: "One calendar across every hospital, with conflict and leave awareness built in." },
            { icon: <ReceiptIndianRupee size={18} strokeWidth={1.25} />, t: "Billing & insurance", d: "Invoices, payments and claim status tracked against the same visit record." },
            { icon: <Users size={18} strokeWidth={1.25} />, t: "Staff & roles", d: "Front desk, nursing, billing and administrators each see only their slice." },
            { icon: <ScanLine size={18} strokeWidth={1.25} />, t: "Documents & scans", d: "Attach scanned reports; text is extracted so paper becomes searchable." },
          ].map((f) => (
            <RevealItem key={f.t} className="sm:col-span-1 md:col-span-6 lg:col-span-3">
              <div className="group h-full rounded-[1.75rem] bg-white p-2 ring-1 ring-inset ring-emerald-950/[0.07] transition-shadow duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_30px_60px_-40px_rgba(6,60,45,0.45)]">
                <div className="h-full rounded-[1.25rem] bg-gradient-to-b from-slate-50/80 to-white p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-inset ring-emerald-950/[0.07]">
                    {f.icon}
                  </span>
                  <h3 className="font-display mt-6 text-[17px] font-bold tracking-[-0.02em] text-emerald-950">
                    {f.t}
                  </h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-slate-600">{f.d}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* ── EMR ──────────────────────────────────────────────────────────── */}
      <Section id="emr" className="bg-gradient-to-b from-white via-slate-50/60 to-white">
        <Split
          eyebrow="Electronic medical records"
          title={<>Notes that stay legible five years later.</>}
          lede="Structured consultation notes with vitals, diagnosis, investigations and plan — captured in the room, not written up afterwards from memory."
          points={[
            {
              icon: <ClipboardPlus size={17} strokeWidth={1.25} />,
              label: "Templates per specialty",
              desc: "Start from a template that matches how you actually examine, then edit freely.",
            },
            {
              icon: <History size={17} strokeWidth={1.25} />,
              label: "Full patient timeline",
              desc: "Every visit, prescription, result and admission on one scrollable thread.",
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
                aspect="aspect-[4/5]"
                sizes="(max-width: 1024px) 92vw, 46vw"
                quality={82}
                radius="2.25rem"
              />
            </Reveal>
            <div className="pointer-events-none absolute -bottom-10 -right-3 hidden w-[42%] lg:block">
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

      {/* ── Multi-hospital ───────────────────────────────────────────────── */}
      <Section id="hospitals">
        <Split
          flip
          eyebrow="Multi-hospital management"
          title={<>Switch hospitals the way you switch rooms.</>}
          lede="Add a hospital, set your consulting hours there, and it appears in the same account. Nothing is duplicated, and nothing has to be reconciled at the end of the month."
          points={[
            {
              icon: <Building2 size={17} strokeWidth={1.25} />,
              label: "Unlimited sites per doctor",
              desc: "Each with its own schedule, staff, rates and invoice series.",
            },
            {
              icon: <CalendarRange size={17} strokeWidth={1.25} />,
              label: "One calendar, colour-coded",
              desc: "See Monday at one hospital and Tuesday at another without opening two systems.",
            },
            {
              icon: <Activity size={17} strokeWidth={1.25} />,
              label: "Per-site and combined reporting",
              desc: "Revenue and volume by hospital, or rolled up across your whole practice.",
            },
          ]}
        >
          <div className="relative">
            <Reveal>
              <Frame
                src={`${IMG}/hospital-operations-hologram-team.jpg`}
                alt="A clinical team reviewing a hospital operations overview on a large interactive display"
                aspect="aspect-[11/10]"
                sizes="(max-width: 1024px) 92vw, 46vw"
                quality={82}
                radius="2.25rem"
              />
            </Reveal>
            <div className="pointer-events-none absolute -bottom-10 -left-3 hidden w-[40%] lg:block">
              <Reveal delay={0.14}>
                <Frame
                  src={`${IMG}/front-desk-practice-workstation.jpg`}
                  alt="Front-desk staff managing appointments on a practice management workstation"
                  aspect="aspect-square"
                  sizes="20vw"
                  radius="1.5rem"
                  className="shadow-[0_40px_70px_-35px_rgba(6,60,45,0.5)]"
                />
              </Reveal>
            </div>
          </div>
        </Split>
      </Section>

      {/* ── Patient journey ──────────────────────────────────────────────── */}
      <Section id="journey" className="bg-gradient-to-b from-white via-emerald-50/40 to-white">
        <SectionHead
          eyebrow="Patient journey"
          title={<>From first call to follow-up, on one thread.</>}
          lede="Every stage writes to the same record, so the next person to see the patient starts from what actually happened rather than from what was remembered."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
                  <div className="flex items-start gap-5 rounded-2xl bg-white p-5 ring-1 ring-inset ring-emerald-950/[0.07]">
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
      </Section>

      {/* ── Surgery ──────────────────────────────────────────────────────── */}
      <Section id="surgery">
        <Split
          eyebrow="Surgery workflow"
          title={<>Every operation, documented the same way.</>}
          lede="Schedule the theatre, record the operative note against a consistent structure, and keep the pre-op diagnosis, findings and post-op plan attached to the patient's timeline."
          points={[
            {
              icon: <Stethoscope size={17} strokeWidth={1.25} />,
              label: "Structured operative notes",
              desc: "Pre-op and post-op diagnosis, procedure, surgeon, anaesthesia and complications — the same fields every time.",
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
            <div className="pointer-events-none absolute -bottom-10 -right-3 hidden w-[42%] lg:block">
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
      </Section>

      {/* ── Analytics ────────────────────────────────────────────────────── */}
      <Section id="analytics" className="bg-gradient-to-b from-white via-slate-50/60 to-white">
        <Split
          flip
          eyebrow="Dashboard & analytics"
          title={<>The numbers you actually run the practice on.</>}
          lede="Today's queue, this month's revenue by hospital, no-show rate, repeat-visit rate — computed from the same records your staff are already entering, so there is no separate reporting exercise."
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
            <div className="pointer-events-none absolute -bottom-10 -left-3 hidden w-[40%] lg:block">
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
      </Section>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <Section id="security">
        <SectionHead
          eyebrow="Security"
          title={<>Built to be defensible, not just encrypted.</>}
          lede="Patient data carries obligations. PPMS is designed so that who saw what, and when, is always answerable — and so that access is granted by role rather than by trust."
        />

        <RevealGroup className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.05}>
          {[
            { icon: <Lock size={19} strokeWidth={1.25} />, label: "Encrypted in transit & at rest" },
            { icon: <ShieldCheck size={19} strokeWidth={1.25} />, label: "Role-based access control" },
            { icon: <History size={19} strokeWidth={1.25} />, label: "Immutable audit log" },
            { icon: <Fingerprint size={19} strokeWidth={1.25} />, label: "Two-factor authentication" },
            { icon: <Cloud size={19} strokeWidth={1.25} />, label: "Redundant cloud hosting" },
            { icon: <Database size={19} strokeWidth={1.25} />, label: "Automated daily backups" },
            { icon: <BadgeCheck size={19} strokeWidth={1.25} />, label: "HIPAA-aligned design" },
            { icon: <Activity size={19} strokeWidth={1.25} />, label: "Session & device visibility" },
          ].map((s) => (
            <RevealItem key={s.label}>
              <div className="h-full rounded-[1.5rem] bg-white p-2 ring-1 ring-inset ring-emerald-950/[0.07]">
                <div className="flex h-full flex-col items-center gap-4 rounded-[1rem] bg-gradient-to-b from-slate-50/80 to-white px-4 py-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                    {s.icon}
                  </span>
                  <span className="text-[13.5px] font-medium leading-snug text-emerald-950">
                    {s.label}
                  </span>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-[13.5px] leading-relaxed text-slate-500">
            HIPAA-aligned design describes how the platform is built — access control, audit
            logging and encryption. It is not a certification claim, and we will say so plainly in
            any procurement conversation.
          </p>
        </Reveal>
      </Section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <Section className="bg-gradient-to-b from-white via-emerald-50/40 to-white">
        <SectionHead
          eyebrow="Practitioners"
          title={<>Built around how doctors already work.</>}
        />

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:hidden">
          <Reveal>
            <Frame
              src={`${IMG}/doctor-tablet-portrait-warm.jpg`}
              alt="A doctor reviewing patient information on a tablet"
              aspect="aspect-square"
              sizes="92vw"
              quality={80}
              radius="1.75rem"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <Frame
              src={`${IMG}/doctor-tablet-portrait-cool.jpg`}
              alt="A doctor reading a patient chart on a tablet in a darkened ward"
              aspect="aspect-[3/4]"
              sizes="92vw"
              quality={80}
              radius="1.75rem"
            />
          </Reveal>
        </div>

        <div className="mt-16 hidden items-start gap-6 lg:grid lg:grid-cols-[0.8fr_1.4fr_0.8fr]">
          <Parallax distance={22}>
            <Reveal>
              <Frame
                src={`${IMG}/doctor-tablet-portrait-warm.jpg`}
                alt="A doctor reviewing patient information on a tablet"
                aspect="aspect-square"
                sizes="24vw"
                quality={80}
                radius="1.75rem"
              />
            </Reveal>
          </Parallax>

          <RevealGroup className="flex flex-col gap-4" stagger={0.08}>
            {TESTIMONIALS.map((t) => (
              <RevealItem key={t.name}>
                <figure className="rounded-[1.75rem] bg-white p-2 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_30px_60px_-50px_rgba(6,60,45,0.6)]">
                  <div className="rounded-[1.25rem] bg-gradient-to-b from-slate-50/70 to-white p-7">
                    <blockquote className="font-display text-[17px] font-medium leading-relaxed tracking-[-0.01em] text-emerald-950">
                      &ldquo;{t.text}&rdquo;
                    </blockquote>
                    <figcaption className="mt-6 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-950 text-[13px] font-semibold text-white">
                        {t.name
                          .replace("Dr. ", "")
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <span>
                        <span className="block text-[14px] font-semibold text-emerald-950">
                          {t.name}
                        </span>
                        <span className="block text-[13px] text-slate-500">{t.role}</span>
                      </span>
                    </figcaption>
                  </div>
                </figure>
              </RevealItem>
            ))}
          </RevealGroup>

          <Parallax distance={-22}>
            <Reveal delay={0.08}>
              <Frame
                src={`${IMG}/doctor-tablet-portrait-cool.jpg`}
                alt="A doctor reading a patient chart on a tablet in a darkened ward"
                aspect="aspect-[3/4]"
                sizes="24vw"
                quality={80}
                radius="1.75rem"
              />
            </Reveal>
          </Parallax>
        </div>

        {/* Quotes again for narrow screens, where the three-column frame collapses. */}
        <RevealGroup className="mt-4 flex flex-col gap-4 lg:hidden" stagger={0.08}>
          {TESTIMONIALS.map((t) => (
            <RevealItem key={t.name}>
              <figure className="rounded-[1.75rem] bg-white p-2 ring-1 ring-inset ring-emerald-950/[0.07]">
                <div className="rounded-[1.25rem] bg-gradient-to-b from-slate-50/70 to-white p-6">
                  <blockquote className="font-display text-[16px] font-medium leading-relaxed text-emerald-950">
                    &ldquo;{t.text}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 text-[13px] text-slate-500">
                    <span className="font-semibold text-emerald-950">{t.name}</span> · {t.role}
                  </figcaption>
                </div>
              </figure>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Section id="pricing">
        <SectionHead
          eyebrow="Pricing"
          title={<>Priced per practice, not per patient.</>}
          lede="Start on the 30-day trial without a card. Move to a paid plan only when the practice is actually running on it."
        />

        {/* Three-up from md — stacking full-width plan cards on a 768px tablet
            wastes the width and pushes the comparison off-screen. */}
        <RevealGroup
          className="mt-12 grid items-stretch gap-4 sm:mt-16 md:grid-cols-3"
          stagger={0.08}
        >
          {PLANS.map((p) => (
            <RevealItem key={p.name} className="h-full">
              <div
                className={[
                  "flex h-full flex-col rounded-[2rem] p-2 ring-1 ring-inset",
                  p.featured
                    ? "bg-emerald-950 ring-emerald-950 shadow-[0_40px_80px_-50px_rgba(6,60,45,0.9)]"
                    : "bg-white ring-emerald-950/[0.07]",
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

                  <div className="mt-6 flex flex-wrap items-baseline gap-x-2 sm:mt-8">
                    <span
                      className={`font-display text-[clamp(2rem,3.2vw,2.5rem)] font-bold tracking-[-0.03em] ${
                        p.featured ? "text-white" : "text-emerald-950"
                      }`}
                    >
                      {p.price}
                    </span>
                    <span className={`text-[13.5px] ${p.featured ? "text-emerald-200/60" : "text-slate-500"}`}>
                      {p.period}
                    </span>
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
                    href={p.name === "Enterprise" ? "#contact" : "/login"}
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
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display mt-5 text-[clamp(1.6rem,5.4vw,2.625rem)] font-bold leading-[1.07] tracking-[-0.03em] text-balance text-emerald-950 sm:mt-6">
              Questions we get asked before the first demo.
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-slate-600">
              If yours is not here, ask it directly — we would rather answer honestly up front than
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

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <Section id="contact" className="pb-16 md:pb-20 lg:pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-emerald-950 p-2 ring-1 ring-inset ring-emerald-950">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-emerald-500/15 blur-[100px]"
            />
            <div className="relative rounded-[2rem] px-6 py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] sm:px-12 sm:py-24">
              <h2 className="font-display mx-auto max-w-3xl text-[clamp(1.7rem,5.6vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.03em] text-balance text-white">
                Run every hospital you practise at from one account.
              </h2>
              <p className="mx-auto mt-7 max-w-xl text-[16.5px] leading-relaxed text-emerald-100/70">
                Thirty days, no card, no commitment. If it does not fit how your practice actually
                works, we would rather you found that out for free.
              </p>

              <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Magnetic
                  href="/login"
                  className="group inline-flex items-center justify-between gap-3 rounded-full bg-white py-2 pl-7 pr-2 text-[15px] font-semibold text-emerald-950"
                >
                  Start 30-day free trial
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-950/8 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[3px] group-hover:-translate-y-[2px] group-hover:scale-105">
                    <ArrowUpRight size={17} strokeWidth={1.25} aria-hidden="true" />
                  </span>
                </Magnetic>
                <a
                  href="tel:+919629051083"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-4 text-[15px] font-medium text-white transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.07]"
                >
                  <Phone size={15} strokeWidth={1.25} aria-hidden="true" />
                  +91 96290 51083
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className={`border-t border-emerald-950/[0.07] ${GUTTER} py-14 sm:py-16`}>
        <div className={`grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr] ${SHELL}`}>
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/landing/logo-ppms-new.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="font-display text-[16px] font-bold tracking-tight text-emerald-950">
                PPMS
              </span>
            </div>
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-slate-500">
              Patient practice management for doctors working across multiple hospitals. A product
              of RAPDFLY PRIVATE LIMITED.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 text-[13.5px] text-slate-500">
              <a href="mailto:support@ppmsai.com" className="flex items-center gap-2 hover:text-emerald-800">
                <Mail size={14} strokeWidth={1.25} aria-hidden="true" />
                support@ppmsai.com
              </a>
              <a href="tel:+919629051083" className="flex items-center gap-2 hover:text-emerald-800">
                <Phone size={14} strokeWidth={1.25} aria-hidden="true" />
                +91 96290 51083
              </a>
              <span className="flex items-center gap-2">
                <MapPin size={14} strokeWidth={1.25} aria-hidden="true" />
                Tamil Nadu, India
              </span>
            </div>
          </div>

          {[
            { h: "Platform", links: [["Overview", "#platform"], ["Medical records", "#emr"], ["Multi-hospital", "#hospitals"], ["Surgery", "#surgery"]] },
            { h: "Company", links: [["Analytics", "#analytics"], ["Security", "#security"], ["Pricing", "#pricing"], ["FAQ", "#faq"]] },
            { h: "Get started", links: [["Sign in", "/login"], ["Free trial", "/login"], ["Book a demo", "#contact"], ["Contact", "mailto:support@ppmsai.com"]] },
          ].map((col) => (
            <div key={col.h}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-950">
                {col.h}
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
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

        <div className={`mt-12 flex flex-col gap-3 border-t border-emerald-950/[0.07] pt-8 text-[13px] text-slate-400 sm:mt-14 sm:flex-row sm:items-center sm:justify-between ${SHELL}`}>
          <p>© {new Date().getFullYear()} RAPDFLY PRIVATE LIMITED. All rights reserved.</p>
          <p>ppmsai.com</p>
        </div>
      </footer>
    </div>
  );
}
