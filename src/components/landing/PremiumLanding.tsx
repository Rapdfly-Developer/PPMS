import Image from "next/image";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarRange,
  ChartNoAxesColumn,
  Check,
  ClipboardPlus,
  FileText,
  Fingerprint,
  History,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  MessageSquareText,
  Mic,
  Phone,
  Pill,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

import { Faq, type FaqItem } from "./Faq";
import { Nav } from "./Nav";
import { DemoForm } from "./DemoForm";
import { Magnetic, Reveal, RevealGroup, RevealItem } from "./ui";
import {
  AppointmentScreen,
  DashboardMock,
  EmrScreen,
  PatientScreen,
  ScreenCard,
} from "./ProductMock";

/* ═══ Shared primitives (server-rendered, no client JS) ════════════════════ */

/** Content cap. Tracks the viewport up to 4K; see globals.css. */
const SHELL = "container-fluid";
/** Horizontal gutter, shared by every section so all edges line up. */
const GUTTER = "gutter-fluid";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-emerald-800 ring-1 ring-inset ring-emerald-600/10 4xl:px-5 4xl:py-2 4xl:text-[13px]">
      {children}
    </span>
  );
}

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
      className={`lp-section scroll-mt-24 sm:scroll-mt-28 ${GUTTER} py-14 sm:py-16 md:py-20 lg:py-24 ${className}`}
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
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  align?: "center" | "left";
}) {
  return (
    <Reveal
      className={
        align === "center"
          ? "mx-auto max-w-[var(--lp-measure)] text-center"
          : "max-w-[var(--lp-measure)]"
      }
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
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

/** White card on a soft ground. The single card shape used page-wide. */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`h-full rounded-[1.5rem] bg-white p-6 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_2px_10px_-6px_rgba(6,60,45,0.12)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-[0_24px_50px_-38px_rgba(6,60,45,0.5)] 3xl:p-8 4xl:rounded-[2rem] 4xl:p-10 ${className}`}
    >
      {children}
    </div>
  );
}

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10 4xl:h-16 4xl:w-16 4xl:rounded-3xl">
      {children}
    </span>
  );
}

/* ═══ Page data ════════════════════════════════════════════════════════════ */

const PLATFORM = [
  {
    icon: <Users size={20} strokeWidth={1.25} />,
    title: "Patients",
    body: "One profile per person, carrying identifiers, contact details and every visit made at any hospital you practise at.",
  },
  {
    icon: <CalendarRange size={20} strokeWidth={1.25} />,
    title: "Appointments",
    body: "Booking, confirmation and rescheduling against the doctor actually sitting that session, per hospital.",
  },
  {
    icon: <ClipboardPlus size={20} strokeWidth={1.25} />,
    title: "EMR",
    body: "Structured complaints, examination, diagnosis and plan, written once and readable from any location.",
  },
  {
    icon: <Pill size={20} strokeWidth={1.25} />,
    title: "Prescriptions",
    body: "Issued from the consultation itself, printed or shared, and kept on the visit that produced them.",
  },
  {
    icon: <ScanLine size={20} strokeWidth={1.25} />,
    title: "Investigations",
    body: "Orders raised in view of a finding, with results attached back to the patient and made searchable.",
  },
  {
    icon: <History size={20} strokeWidth={1.25} />,
    title: "Follow-ups",
    body: "Tracked against the visit that advised them, so nothing depends on a separate list being maintained.",
  },
];

const WORKFLOW = [
  { icon: <Users size={18} strokeWidth={1.25} />, label: "Patient", note: "Registered once" },
  { icon: <CalendarRange size={18} strokeWidth={1.25} />, label: "Appointment", note: "Slot confirmed" },
  { icon: <Stethoscope size={18} strokeWidth={1.25} />, label: "Consultation", note: "Queue to room" },
  { icon: <ClipboardPlus size={18} strokeWidth={1.25} />, label: "EMR", note: "Findings recorded" },
  { icon: <ScanLine size={18} strokeWidth={1.25} />, label: "Investigation", note: "Ordered in view of" },
  { icon: <Pill size={18} strokeWidth={1.25} />, label: "Treatment", note: "Plan and prescription" },
  { icon: <History size={18} strokeWidth={1.25} />, label: "Follow-up", note: "Scheduled from the visit" },
];

const AI_FEATURES = [
  {
    icon: <Sparkles size={20} strokeWidth={1.25} />,
    title: "AI Copilot",
    body: "Reads the record you already keep and gives it back shorter. It drafts, it does not decide.",
  },
  {
    icon: <Mic size={20} strokeWidth={1.25} />,
    title: "Voice to EMR",
    body: "Dictate the consultation and have it land in the structured fields, yours to correct before saving.",
  },
  {
    icon: <FileText size={20} strokeWidth={1.25} />,
    title: "Patient summary",
    body: "History, medications and investigations condensed into a brief you can read before the patient sits down.",
  },
  {
    icon: <MessageSquareText size={20} strokeWidth={1.25} />,
    title: "Documentation assistance",
    body: "Discharge notes and letters drafted from the visit, returned for review and saved by you.",
  },
];

const MODULES = [
  { icon: <LayoutDashboard size={18} strokeWidth={1.25} />, title: "Dashboard", body: "The day at a glance, per hospital." },
  { icon: <Users size={18} strokeWidth={1.25} />, title: "Patients", body: "Registry, identifiers and visit history." },
  { icon: <CalendarRange size={18} strokeWidth={1.25} />, title: "Appointments", body: "Booking, queue and availability." },
  { icon: <ClipboardPlus size={18} strokeWidth={1.25} />, title: "EMR", body: "Structured clinical records." },
  { icon: <Pill size={18} strokeWidth={1.25} />, title: "Prescriptions", body: "Issued and printed from the visit." },
  { icon: <ScanLine size={18} strokeWidth={1.25} />, title: "Investigations", body: "Orders and attached results." },
  { icon: <MessageSquareText size={18} strokeWidth={1.25} />, title: "Counseling", body: "Advice and decision tracking." },
  { icon: <History size={18} strokeWidth={1.25} />, title: "Follow-ups", body: "Scheduled against the advising visit." },
  { icon: <ChartNoAxesColumn size={18} strokeWidth={1.25} />, title: "Reports", body: "OPD and theatre volumes." },
  { icon: <Settings size={18} strokeWidth={1.25} />, title: "Settings", body: "Hospitals, roles and permissions." },
];

const SECURITY = [
  {
    icon: <Fingerprint size={20} strokeWidth={1.25} />,
    title: "Role-based access",
    body: "Doctors, front desk, billing and administrators each see only the parts of a record their role requires.",
  },
  {
    icon: <Lock size={20} strokeWidth={1.25} />,
    title: "Secure data management",
    body: "Records are encrypted in transit and at rest, and scoped to the hospital the session belongs to.",
  },
  {
    icon: <History size={20} strokeWidth={1.25} />,
    title: "Audit trails",
    body: "Every view and edit is written to a log that administrators can review, with the actor and the time.",
  },
  {
    icon: <ShieldCheck size={20} strokeWidth={1.25} />,
    title: "Controlled permissions",
    body: "Permissions are set per hospital in Role Manager and take effect on the user's next request.",
  },
];

const HOSPITALS = [
  { name: "Apollo Speciality", city: "Chennai", session: "Mon, Wed, Fri", role: "Consultant" },
  { name: "Lakeview Medical Centre", city: "Coimbatore", session: "Tue, Thu", role: "Visiting" },
  { name: "Harbour Clinic", city: "Kochi", session: "Sat", role: "Owner" },
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
    q: "Is the 30-day trial limited in any way?",
    a: "The trial gives one doctor account and up to two hospitals, with appointments, EMR and basic billing enabled. No card is required to start, and nothing is charged when the trial ends, you choose whether to continue.",
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

/* ═══ Page ═════════════════════════════════════════════════════════════════ */

export function PremiumLanding() {
  return (
    <div
      id="top"
      className="ppms-landing font-body min-h-screen bg-white text-emerald-950 antialiased"
    >
      <Nav />

      {/* ── Hero ──────────────────────────────────────────────────────────
          From 1920px up the hero claims the first screen and centres its
          content in it. Below that the height stays content-driven, so a
          900px laptop is not made to scroll past a deliberately empty band. */}
      <section
        className={`relative overflow-hidden ${GUTTER} pb-14 pt-32 sm:pb-16 sm:pt-36 lg:pb-20 lg:pt-40 4xl:flex 4xl:min-h-svh 4xl:items-center 4xl:py-28`}
      >
        {/* Two soft tints, the only colour in the page background. Blurred
            once, never animated, and well below the content. */}
        <div
          aria-hidden="true"
          className="ppms-orb-a pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-emerald-200/30 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="ppms-orb-b pointer-events-none absolute -right-52 top-40 h-[620px] w-[620px] rounded-full bg-teal-100/45 blur-[130px]"
        />

        <div
          className={`relative grid w-full items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 4xl:gap-20 ${SHELL}`}
        >
          <div>
            <Reveal y={20}>
              <div className="flex items-center gap-3">
                <Image
                  src="/landing/logo-rf-health.webp"
                  alt=""
                  width={48}
                  height={48}
                  className="h-11 w-11 rounded-xl object-cover ring-1 ring-emerald-950/[0.08] 4xl:h-16 4xl:w-16 4xl:rounded-2xl"
                  priority
                />
                <span className="font-display text-[19px] font-bold tracking-tight text-emerald-950 4xl:text-[26px]">
                  RF Health
                </span>
              </div>
            </Reveal>

            <Reveal y={34} delay={0.06}>
              <h1 className="font-display mt-6 text-[length:var(--lp-h1)] font-bold leading-[1.04] tracking-[-0.035em] text-balance text-emerald-950">
                Intelligent Healthcare.
                <br />
                <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  Connected Care.
                </span>
              </h1>
            </Reveal>

            <Reveal y={24} delay={0.14}>
              <p className="mt-6 max-w-xl text-[length:var(--lp-lede-hero)] leading-relaxed text-slate-600 2xl:max-w-[680px] 4xl:max-w-[820px] 5xl:max-w-[900px]">
                One intelligent platform to connect patients, clinical workflows, EMR, appointments
                and AI-assisted healthcare.
              </p>
            </Reveal>

            <Reveal y={20} delay={0.22}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Magnetic
                  href="#contact"
                  className="group inline-flex items-center justify-between gap-3 rounded-full bg-emerald-950 py-2 pl-7 pr-2 text-[15px] font-semibold text-white shadow-[0_20px_40px_-20px_rgba(6,60,45,0.6)] 4xl:py-3 4xl:pl-10 4xl:pr-3 4xl:text-[19px]"
                >
                  Book a Free Demo
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[3px] group-hover:-translate-y-[2px] group-hover:scale-105 4xl:h-14 4xl:w-14">
                    <ArrowUpRight size={17} strokeWidth={1.25} aria-hidden="true" />
                  </span>
                </Magnetic>

                <a
                  href="#platform"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-950/[0.1] px-7 py-4 text-[15px] font-medium text-emerald-950 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-emerald-50 4xl:px-10 4xl:py-5 4xl:text-[19px]"
                >
                  Explore RF HEALTH
                </a>
              </div>
            </Reveal>

            <Reveal y={16} delay={0.3}>
              <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13.5px] text-slate-500">
                {["No credit card", "Set up in minutes", "Cancel anytime"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check size={14} strokeWidth={1.75} className="text-emerald-600" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Product visual. Drawn in code rather than shipped as an image, so
              it stays sharp at 3840 and costs no payload. */}
          <Reveal y={40} delay={0.1} className="relative">
            <DashboardMock />
            <p className="mt-3 text-center text-[12px] text-slate-400 4xl:mt-5 4xl:text-[15px]">
              RF Health console. Sample data shown.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── One platform ──────────────────────────────────────────────────── */}
      <Section id="platform" className="bg-gradient-to-b from-white via-emerald-50/40 to-white">
        <SectionHead
          eyebrow="The platform"
          title={<>One Platform. Complete Healthcare Management.</>}
          lede="Six parts of the same record rather than six systems that have to be reconciled. What is written in one is immediately true in the others."
        />

        <RevealGroup
          className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3 4xl:gap-5"
          stagger={0.05}
        >
          {PLATFORM.map((m) => (
            <RevealItem key={m.title}>
              <Card>
                <CardIcon>{m.icon}</CardIcon>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-emerald-950 4xl:mt-7 4xl:text-[22px]">
                  {m.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-600 4xl:mt-4 4xl:text-[17px]">
                  {m.body}
                </p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* ── Clinical workflow ─────────────────────────────────────────────
          A seven-step rail. Horizontal from lg up, where the full width is
          the point; a vertical list below that, where squeezing seven cards
          into a phone would make every one of them illegible. */}
      <Section id="workflow">
        <SectionHead
          eyebrow="Clinical workflow"
          title={<>From first contact to follow-up, in one line.</>}
          lede="Each step hands the next one everything it needs. Nothing is re-keyed, and nothing waits on a system that has not been told yet."
        />

        <Reveal className="mt-10 sm:mt-14">
          <div className="relative">
            {/* Connecting rail, behind the nodes. */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-[34px] hidden h-px bg-gradient-to-r from-emerald-100 via-emerald-300 to-emerald-100 lg:block 4xl:top-[46px]"
            />
            <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-7 lg:gap-3 4xl:gap-5">
              {WORKFLOW.map((s, i) => (
                <li key={s.label} className="flex gap-4 lg:flex-col lg:gap-0 lg:text-center">
                  <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-inset ring-emerald-600/15 shadow-[0_2px_10px_-4px_rgba(6,60,45,0.18)] lg:mx-auto 4xl:h-[92px] 4xl:w-[92px]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 4xl:h-16 4xl:w-16">
                      {s.icon}
                    </span>
                  </span>
                  <div className="min-w-0 lg:mt-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600 4xl:text-[12.5px]">
                      Step {i + 1}
                    </div>
                    <div className="mt-1 text-[15.5px] font-semibold tracking-tight text-emerald-950 4xl:text-[20px]">
                      {s.label}
                    </div>
                    <div className="mt-1 text-[13px] leading-relaxed text-slate-500 4xl:text-[16px]">
                      {s.note}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </Section>

      {/* ── AI ────────────────────────────────────────────────────────────
          Copy is held to what the Clinical Copilot plugin actually does per
          its manifest: summarise, ask, draft, all gated by role. "It drafts,
          it does not decide" is a real product constraint rather than
          reassurance: output returns for review and is saved by the doctor,
          and the plugin is off by default even for hospital admins. */}
      <Section id="ai" className="bg-gradient-to-b from-white via-slate-50/70 to-white">
        <SectionHead
          eyebrow="Clinical AI"
          title={<>Intelligence That Supports Better Care.</>}
          lede="The Copilot reads the record you already keep and gives it back to you as something shorter. Everything it produces is yours to accept or discard."
        />

        <div className="mt-10 grid items-center gap-10 sm:mt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14 4xl:gap-20">
          <RevealGroup className="grid gap-4 sm:grid-cols-2 4xl:gap-5" stagger={0.06}>
            {AI_FEATURES.map((f) => (
              <RevealItem key={f.title}>
                <Card>
                  <CardIcon>{f.icon}</CardIcon>
                  <h3 className="mt-5 text-[16.5px] font-semibold tracking-tight text-emerald-950 4xl:mt-7 4xl:text-[21px]">
                    {f.title}
                  </h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-slate-600 4xl:mt-4 4xl:text-[17px]">
                    {f.body}
                  </p>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>

          {/* Light data visual. Teal marks on white, no dark panel. */}
          <Reveal y={30} delay={0.08}>
            <div className="overflow-hidden rounded-[1.75rem] bg-white p-6 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_30px_70px_-50px_rgba(6,60,45,0.4)] 4xl:rounded-[2.25rem] 4xl:p-10">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold tracking-tight text-emerald-950 4xl:text-[17px]">
                  Visit summary
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 4xl:px-4 4xl:py-1.5 4xl:text-[12.5px]">
                  <Sparkles size={11} strokeWidth={1.5} aria-hidden="true" />
                  Draft
                </span>
              </div>

              <svg viewBox="0 0 360 132" className="mt-5 w-full" aria-hidden="true">
                <defs>
                  <linearGradient id="rf-ai-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0D7A63" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#2BA89C" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3].map((r) => (
                  <rect key={r} x="0" y={r * 34} width="360" height="1" fill="#EEF3F2" />
                ))}
                <rect x="0" y="6" width="248" height="14" rx="7" fill="url(#rf-ai-grad)" />
                <rect x="0" y="40" width="300" height="14" rx="7" fill="url(#rf-ai-grad)" />
                <rect x="0" y="74" width="196" height="14" rx="7" fill="url(#rf-ai-grad)" />
                <rect x="0" y="108" width="266" height="14" rx="7" fill="url(#rf-ai-grad)" />
                <circle cx="330" cy="13" r="5" fill="#0D7A63" opacity="0.5" />
                <circle cx="330" cy="47" r="5" fill="#0D7A63" opacity="0.35" />
                <circle cx="330" cy="81" r="5" fill="#0D7A63" opacity="0.22" />
                <circle cx="330" cy="115" r="5" fill="#0D7A63" opacity="0.14" />
              </svg>

              <div className="mt-5 flex flex-col gap-2.5 4xl:mt-8 4xl:gap-4">
                {[
                  "Reads history, medications and investigations",
                  "Returns a brief before the patient sits down",
                  "Never writes to the record on its own",
                ].map((t) => (
                  <div
                    key={t}
                    className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-slate-600 4xl:gap-4 4xl:text-[16.5px]"
                  >
                    <Check size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ── Multi-hospital ────────────────────────────────────────────────── */}
      <Section id="hospitals">
        <SectionHead
          eyebrow="Multi-hospital"
          title={<>One Doctor. Multiple Hospitals. One Connected Platform.</>}
          lede="Each hospital keeps its own schedule, billing and staff roles. The clinical history stays unified under the patient rather than the building."
        />

        <div className="mt-10 grid items-center gap-10 sm:mt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 4xl:gap-20">
          {/* Light network visual. */}
          <Reveal y={30}>
            <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-emerald-50/70 to-white p-6 ring-1 ring-inset ring-emerald-950/[0.07] 4xl:rounded-[2.25rem] 4xl:p-10">
              <svg viewBox="0 0 400 260" className="w-full" role="img" aria-label="One account connected to three hospital locations">
                <g stroke="#9CCFC4" strokeWidth="1.5" strokeDasharray="4 5" fill="none">
                  <path d="M200,130 L92,62" />
                  <path d="M200,130 L318,74" />
                  <path d="M200,130 L120,206" />
                  <path d="M200,130 L306,196" />
                </g>
                {[
                  { x: 92, y: 62 },
                  { x: 318, y: 74 },
                  { x: 120, y: 206 },
                  { x: 306, y: 196 },
                ].map((p) => (
                  <g key={`${p.x}-${p.y}`}>
                    <circle cx={p.x} cy={p.y} r="26" fill="#FFFFFF" stroke="#D7E8E2" strokeWidth="1.5" />
                    <circle cx={p.x} cy={p.y} r="8" fill="#0D7A63" opacity="0.18" />
                    <circle cx={p.x} cy={p.y} r="4" fill="#0D7A63" />
                  </g>
                ))}
                <circle cx="200" cy="130" r="44" fill="#FFFFFF" stroke="#0D7A63" strokeWidth="2" />
                <circle cx="200" cy="130" r="56" fill="none" stroke="#0D7A63" strokeWidth="1" opacity="0.18" />
                <circle cx="200" cy="130" r="14" fill="#0D7A63" opacity="0.14" />
                <circle cx="200" cy="130" r="7" fill="#0D7A63" />
              </svg>
              <p className="mt-2 text-center text-[12.5px] text-slate-500 4xl:text-[15.5px]">
                One account at the centre. Each node is a hospital you practise at.
              </p>
            </div>
          </Reveal>

          <RevealGroup className="flex flex-col gap-4 4xl:gap-5" stagger={0.07}>
            {HOSPITALS.map((h) => (
              <RevealItem key={h.name}>
                <div className="flex items-center gap-4 rounded-[1.25rem] bg-white p-5 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_2px_10px_-6px_rgba(6,60,45,0.12)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 4xl:gap-6 4xl:rounded-[1.75rem] 4xl:p-8">
                  <CardIcon>
                    <Building2 size={20} strokeWidth={1.25} />
                  </CardIcon>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-semibold tracking-tight text-emerald-950 4xl:text-[20px]">
                      {h.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500 4xl:text-[16px]">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} strokeWidth={1.5} aria-hidden="true" />
                        {h.city}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarRange size={12} strokeWidth={1.5} aria-hidden="true" />
                        {h.session}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 4xl:px-4 4xl:py-1.5 4xl:text-[14px]">
                    {h.role}
                  </span>
                </div>
              </RevealItem>
            ))}
            <RevealItem>
              <p className="px-1 text-[13.5px] leading-relaxed text-slate-500 4xl:text-[16.5px]">
                Switch between them from a single control. Role-based access decides what each
                account sees at each location.
              </p>
            </RevealItem>
          </RevealGroup>
        </div>
      </Section>

      {/* ── Modules ───────────────────────────────────────────────────────
          Ten tiles, which divides by 2 and 5. The five-column step exists
          because past 2560 a four-column row would leave 900px cards holding
          a single line of description. */}
      <Section id="modules" className="bg-gradient-to-b from-white via-emerald-50/40 to-white">
        <SectionHead
          eyebrow="Platform modules"
          title={<>Every module, in the same account.</>}
          lede="Not a core product with the useful parts sold separately. Everything below is on the same patient record from the first day of the trial."
        />

        <RevealGroup
          className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 4xl:gap-5"
          stagger={0.04}
        >
          {MODULES.map((m) => (
            <RevealItem key={m.title}>
              <Card className="!p-5 3xl:!p-6 4xl:!p-8">
                <CardIcon>{m.icon}</CardIcon>
                <h3 className="mt-4 text-[15.5px] font-semibold tracking-tight text-emerald-950 4xl:mt-6 4xl:text-[20px]">
                  {m.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600 4xl:mt-3 4xl:text-[16.5px]">
                  {m.body}
                </p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* ── Product experience ────────────────────────────────────────────── */}
      <Section id="product">
        <SectionHead
          eyebrow="The product"
          title={<>Built to be read at a glance.</>}
          lede="The same record from three sides: who the patient is, when they are coming, and what was found when they arrived."
        />

        <RevealGroup className="mt-10 grid gap-5 sm:mt-14 lg:grid-cols-3 4xl:gap-7" stagger={0.08}>
          <RevealItem>
            <ScreenCard label="Patient profile">
              <PatientScreen />
            </ScreenCard>
          </RevealItem>
          <RevealItem>
            <ScreenCard label="Appointments">
              <AppointmentScreen />
            </ScreenCard>
          </RevealItem>
          <RevealItem>
            <ScreenCard label="Electronic medical record">
              <EmrScreen />
            </ScreenCard>
          </RevealItem>
        </RevealGroup>

        <Reveal>
          <p className="mt-6 text-center text-[12.5px] text-slate-400 4xl:mt-9 4xl:text-[15.5px]">
            Interface shown with sample data.
          </p>
        </Reveal>
      </Section>

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <Section id="security" className="bg-gradient-to-b from-white via-slate-50/70 to-white">
        <SectionHead
          eyebrow="Security"
          title={<>Access decided by role, and written down.</>}
          lede="Patient data carries obligations. These are the controls the product ships with, described plainly rather than claimed broadly."
        />

        <RevealGroup
          className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 4xl:grid-cols-4 4xl:gap-5"
          stagger={0.06}
        >
          {SECURITY.map((s) => (
            <RevealItem key={s.title}>
              <Card>
                <CardIcon>{s.icon}</CardIcon>
                <h3 className="mt-5 text-[16.5px] font-semibold tracking-tight text-emerald-950 4xl:mt-7 4xl:text-[21px]">
                  {s.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-slate-600 4xl:mt-4 4xl:text-[17px]">
                  {s.body}
                </p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <Section id="pricing">
        <SectionHead
          eyebrow="Pricing"
          title={<>One licence, priced by the size of the practice.</>}
          lede="Start on the trial without a card. Move up only when the number of doctors or hospitals asks for it."
        />

        <RevealGroup
          className="mt-10 grid items-stretch gap-4 sm:mt-12 md:grid-cols-3 2xl:mx-auto 2xl:max-w-[1500px] 5xl:max-w-[1880px] 6xl:max-w-[2400px] 4xl:gap-6"
          stagger={0.07}
        >
          {PLANS.map((p) => (
            <RevealItem key={p.name}>
              <div
                className={[
                  "flex h-full flex-col rounded-[1.5rem] p-7 ring-1 ring-inset 4xl:rounded-[2rem] 4xl:p-11",
                  p.featured
                    ? "bg-emerald-950 text-emerald-50 ring-emerald-950"
                    : "bg-white text-emerald-950 ring-emerald-950/[0.07] shadow-[0_2px_10px_-6px_rgba(6,60,45,0.12)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[17px] font-semibold tracking-tight 4xl:text-[22px]">
                      {p.name}
                    </div>
                    <div
                      className={`mt-1 text-[13px] 4xl:text-[16px] ${p.featured ? "text-emerald-300/80" : "text-slate-500"}`}
                    >
                      {p.tag}
                    </div>
                  </div>
                  {p.featured && (
                    <span className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-300 ring-1 ring-inset ring-emerald-300/20 4xl:text-[13px]">
                      Popular
                    </span>
                  )}
                </div>

                <div className="mt-6 flex items-baseline gap-2 4xl:mt-9">
                  <span className="font-display text-[34px] font-bold tracking-[-0.03em] 4xl:text-[46px]">
                    {p.price}
                  </span>
                  <span
                    className={`text-[13.5px] 4xl:text-[17px] ${p.featured ? "text-emerald-300/80" : "text-slate-500"}`}
                  >
                    {p.period}
                  </span>
                </div>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5 4xl:mt-9 4xl:gap-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] leading-relaxed 4xl:gap-4 4xl:text-[17px]">
                      <BadgeCheck
                        size={16}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className={`mt-0.5 shrink-0 ${p.featured ? "text-emerald-400" : "text-emerald-600"}`}
                      />
                      <span className={p.featured ? "text-emerald-50/90" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={p.cta === "Talk to sales" ? "#contact" : "/login"}
                  className={[
                    "mt-7 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-[14.5px] font-semibold transition-colors duration-300 4xl:mt-10 4xl:py-5 4xl:text-[18px]",
                    p.featured
                      ? "bg-white text-emerald-950 hover:bg-emerald-50"
                      : "bg-emerald-950 text-white hover:bg-emerald-900",
                  ].join(" ")}
                >
                  {p.cta}
                </a>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <Section id="faq" className="bg-gradient-to-b from-white via-slate-50/60 to-white">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 4xl:gap-24">
          <SectionHead
            align="left"
            eyebrow="Questions"
            title={<>The things people ask first.</>}
            lede="If your question is not here, the demo form below reaches a person rather than a queue."
          />
          <Reveal delay={0.06}>
            <Faq items={FAQ_ITEMS} />
          </Reveal>
        </div>
      </Section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <Section id="contact">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16 xl:gap-20 4xl:gap-28">
          <SectionHead
            align="left"
            eyebrow="Get in touch"
            title={<>Book a free demo.</>}
            lede="Tell us how many hospitals you practise at and what you run today. We will show you the parts that matter to you rather than a fixed tour."
          />
          <Reveal delay={0.06}>
            <DemoForm />
          </Reveal>
        </div>
      </Section>

      {/* ── Closing CTA ───────────────────────────────────────────────────── */}
      <Section id="cta" className="lp-tight-bottom pb-16 md:pb-20 lg:pb-24">
        <Reveal>
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-50 via-teal-50/80 to-white px-8 py-14 text-center ring-1 ring-inset ring-emerald-600/[0.12] sm:px-12 sm:py-16 4xl:rounded-[3rem] 4xl:px-20 4xl:py-24">
            <h2 className="font-display mx-auto max-w-[var(--lp-measure)] text-[length:var(--lp-h2)] font-bold leading-[1.06] tracking-[-0.03em] text-balance text-emerald-950">
              Experience the Future of Connected Healthcare.
            </h2>
            <p className="mx-auto mt-5 max-w-[var(--lp-measure)] text-[length:var(--lp-lede)] leading-relaxed text-slate-600">
              Discover how RF HEALTH can simplify clinical workflows and bring your healthcare
              operations together.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row 4xl:mt-12">
              <Magnetic
                href="#contact"
                className="group inline-flex items-center justify-between gap-3 rounded-full bg-emerald-950 py-2 pl-7 pr-2 text-[15px] font-semibold text-white shadow-[0_20px_40px_-20px_rgba(6,60,45,0.6)] 4xl:py-3 4xl:pl-10 4xl:pr-3 4xl:text-[19px]"
              >
                Book a Free Demo
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[3px] group-hover:-translate-y-[2px] group-hover:scale-105 4xl:h-14 4xl:w-14">
                  <ArrowUpRight size={17} strokeWidth={1.25} aria-hidden="true" />
                </span>
              </Magnetic>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-emerald-950/[0.12] bg-white/70 px-7 py-4 text-[15px] font-medium text-emerald-950 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white 4xl:px-10 4xl:py-5 4xl:text-[19px]"
              >
                Sign in
              </a>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className={`border-t border-emerald-950/[0.07] ${GUTTER} py-12 sm:py-14 4xl:py-20`}>
        <div className={`grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr] 4xl:gap-16 ${SHELL}`}>
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/landing/logo-rf-health.webp"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-emerald-950/[0.08] 4xl:h-11 4xl:w-11 4xl:rounded-xl"
              />
              <span className="font-display text-[16px] font-bold tracking-tight text-emerald-950 4xl:text-[21px]">
                RF Health
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-slate-500 4xl:max-w-sm 4xl:text-[17px]">
              Patient practice management for doctors working across multiple hospitals. A product
              of RAPDFLY PRIVATE LIMITED.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 text-[13.5px] text-slate-500 4xl:text-[16.5px]">
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
            {
              h: "Product",
              links: [
                ["Platform", "#platform"],
                ["Clinical workflow", "#workflow"],
                ["Modules", "#modules"],
                ["Product tour", "#product"],
              ],
            },
            {
              h: "Company",
              links: [
                ["Clinical AI", "#ai"],
                ["Multi-hospital", "#hospitals"],
                ["Security", "#security"],
                ["Pricing", "#pricing"],
              ],
            },
            {
              h: "Get started",
              links: [
                ["Sign in", "/login"],
                ["Free trial", "/login"],
                ["Book a demo", "#contact"],
                ["Contact", "mailto:support@ppmsai.com"],
              ],
            },
          ].map((col) => (
            <div key={col.h}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-950 4xl:text-[13.5px]">
                {col.h}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5 4xl:mt-6 4xl:gap-4">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[14px] text-slate-500 transition-colors duration-300 hover:text-emerald-800 4xl:text-[17px]"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className={`mt-10 flex flex-col gap-3 border-t border-emerald-950/[0.07] pt-6 text-[13px] text-slate-400 sm:flex-row sm:items-center sm:justify-between 4xl:mt-16 4xl:pt-10 4xl:text-[16px] ${SHELL}`}
        >
          <p>© {new Date().getFullYear()} RAPDFLY PRIVATE LIMITED. All rights reserved.</p>
          <p>ppmsai.com</p>
        </div>
      </footer>
    </div>
  );
}
