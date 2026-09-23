import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "@/components/landing/Nav";
import {
  Mail, Phone, MapPin, ShieldCheck, Lock, Database, Users,
  History, FileText, AlertCircle, Eye, Trash2, RefreshCw,
} from "lucide-react";

const display = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Privacy Policy · RF Health",
  description:
    "Privacy Policy for RF Health by RAPDFLY PRIVATE LIMITED. Learn how we collect, use, protect and retain your personal and health data in compliance with the Digital Personal Data Protection Act, 2023.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "24 September 2026";

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

function SectionCard({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-xl bg-white p-6 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_2px_16px_-6px_rgba(6,60,45,0.06)] sm:p-7 lg:rounded-2xl lg:p-8 2xl:p-10"
    >
      <div className="flex items-start gap-3 mb-5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/[0.12]">
          {icon}
        </span>
        <h2 className="font-display text-[18px] font-bold tracking-tight text-emerald-950 sm:text-[20px] lg:text-[22px] 2xl:text-[24px]">
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-relaxed text-slate-600 mb-4 last:mb-0 sm:text-[15px] 2xl:text-[15.5px]">
      {children}
    </p>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-2 mb-4 last:mb-0 flex flex-col gap-2 pl-0">
      {children}
    </ul>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-relaxed text-slate-600 sm:text-[15px] 2xl:text-[15.5px]">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span>{children}</span>
    </li>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 mb-2 text-[14px] font-semibold tracking-tight text-emerald-950 first:mt-0 sm:text-[15px] 2xl:text-[15.5px]">
      {children}
    </h3>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-[13px] leading-relaxed text-emerald-800 sm:text-[13.5px]">
      {children}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} font-body min-h-screen bg-slate-50/50 text-emerald-950 antialiased`}
    >
      <Nav />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-emerald-950/[0.07] bg-white">
        {/* fluid px: 16px → 40px → 64px as viewport grows */}
        <div
          className="mx-auto w-[min(92%,1760px)] pt-24 pb-8 sm:pt-28 sm:pb-10 lg:pt-32 lg:pb-12 2xl:pt-36 2xl:pb-14"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/[0.08] bg-emerald-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Legal
          </span>
          <h1 className="font-display mt-4 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-emerald-950">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-[min(100%,72ch)] text-[clamp(13.5px,1.5vw,15.5px)] leading-relaxed text-slate-500">
            RF Health is operated by{" "}
            <strong className="font-semibold text-emerald-950">RAPDFLY PRIVATE LIMITED</strong>.
            This policy explains what personal and health data we collect, why we collect it,
            how we protect it, and what rights you have over it.
          </p>
          <p className="mt-3 text-[13px] text-slate-400">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* ── Body: TOC + content ───────────────────────────────────────────── */}
      <div className="mx-auto w-[min(92%,1760px)] py-8 sm:py-10 lg:py-12 2xl:py-14">
        <div className="flex gap-0 lg:gap-8 xl:gap-10 2xl:gap-12 lg:items-start">

          {/* ── Sidebar TOC ─────────────────────────────────────────────── */}
          {/* hidden on mobile/tablet, visible from lg up */}
          <aside className="hidden lg:block lg:w-[clamp(180px,15%,240px)] shrink-0">
            <div className="sticky top-28 rounded-xl bg-white px-4 py-5 ring-1 ring-inset ring-emerald-950/[0.07] 2xl:rounded-2xl 2xl:px-5 2xl:py-6">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 2xl:text-[11px]">
                Contents
              </p>
              <nav aria-label="Privacy policy sections">
                <ul className="flex flex-col gap-0.5">
                  {TOC.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="block rounded-lg px-2.5 py-1.5 text-[12.5px] text-slate-500 transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-800 2xl:text-[13px] 2xl:py-2"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>

          {/* ── Mobile TOC: horizontal scrollable chips ──────────────────── */}
          <div className="mb-6 lg:hidden">
            <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-emerald-950/[0.07]">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Jump to section
              </p>
              <div className="flex flex-wrap gap-2">
                {TOC.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="inline-flex items-center rounded-full border border-emerald-950/[0.08] bg-emerald-50/60 px-3 py-1 text-[12px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* ── Policy content ──────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 flex flex-col gap-4 sm:gap-5 lg:gap-6">

            {/* 1. Overview */}
            <SectionCard id="overview" icon={<FileText size={16} strokeWidth={1.5} />} title="Overview">
              <P>
                RF Health is a cloud-based practice management platform for doctors working across
                multiple hospitals. It processes personal data and sensitive health data on behalf
                of doctors, hospitals, and their patients.
              </P>
              <P>
                <strong className="font-semibold text-emerald-950">Data fiduciary:</strong>{" "}
                RAPDFLY PRIVATE LIMITED determines the purpose and means of processing personal
                data collected through RF Health.
              </P>
              <P>
                This policy applies to all users of RF Health: doctors, hospital administrators,
                front-desk and billing staff, and, indirectly, to patients whose records are
                managed within the platform.
              </P>
              <P>
                By accessing or using RF Health, you confirm that you have read and agree to this
                policy. If you are a hospital or practice onboarding staff, you are responsible
                for informing those staff members of this policy.
              </P>
              <Note>
                <strong>Sensitive personal data.</strong> Patient medical records — diagnoses,
                prescriptions, clinical notes, surgery records, lab and imaging results — constitute
                sensitive personal data under Indian law. We apply heightened protection to this
                category of data throughout the platform.
              </Note>
            </SectionCard>

            {/* 2. Data collected */}
            <SectionCard id="data-collected" icon={<Database size={16} strokeWidth={1.5} />} title="Data we collect">
              <SubHead>Patient data</SubHead>
              <P>When a patient is registered or a visit is recorded, the platform stores:</P>
              <Ul>
                <Li>Full name, date of birth, gender, contact number, and address</Li>
                <Li>Unique patient identifier assigned by the platform</Li>
                <Li>Clinical history: chief complaints, symptoms, examination findings, vitals</Li>
                <Li>Diagnoses, differential diagnoses, and clinical notes</Li>
                <Li>Prescriptions: medication name, dose, duration, refill status</Li>
                <Li>Investigation orders and results (lab and imaging)</Li>
                <Li>Surgery records: pre-operative diagnosis, procedure name, anaesthesia type, operative findings, post-operative instructions, surgeon name</Li>
                <Li>Follow-up appointments and referral notes</Li>
                <Li>Scanned documents attached to a patient record; text is extracted from scans and indexed to make the record searchable</Li>
                <Li>Billing records: invoices, payment status, insurance claim details</Li>
              </Ul>

              <SubHead>Doctor and staff data</SubHead>
              <Ul>
                <Li>Full name, email address, and contact number used for account registration</Li>
                <Li>Role assignment (Doctor, Hospital Admin, Front Desk, Billing, or other configured role)</Li>
                <Li>Hospital affiliations and consulting schedules</Li>
                <Li>Login activity, session timestamps, and IP address</Li>
                <Li>Two-factor authentication device or method (no authentication secrets are stored in plaintext)</Li>
              </Ul>

              <SubHead>Appointment and scheduling data</SubHead>
              <Ul>
                <Li>Appointment date, time, type, status, and assigned hospital</Li>
                <Li>OPD queue position and consultation duration</Li>
                <Li>Cancellations, reschedules, and no-show records</Li>
              </Ul>

              <SubHead>Audit and operational data</SubHead>
              <Ul>
                <Li>An immutable audit log recording every view of, and edit to, a patient record — including the user, timestamp, and action type</Li>
                <Li>System-level event logs for security and operational monitoring</Li>
              </Ul>

              <SubHead>Data we do not collect</SubHead>
              <P>
                We do not collect payment card numbers directly. Any payment processing is
                handled by third-party payment providers under their own terms. We do not
                collect biometric data, genetic data, or social media profiles.
              </P>
            </SectionCard>

            {/* 3. How we use */}
            <SectionCard id="how-we-use" icon={<Eye size={16} strokeWidth={1.5} />} title="How we use your data">
              <P>We use the data we collect solely to provide and improve the RF Health service:</P>
              <Ul>
                <Li>Creating and maintaining patient records accessible across a doctor&apos;s registered hospitals</Li>
                <Li>Scheduling and managing appointments and operating-theatre slots</Li>
                <Li>Generating prescriptions, consultation summaries, dispense summaries, and operative reports in PDF format</Li>
                <Li>Producing analytics and operational reports — appointment volumes, completion rates, revenue summaries — from the records already entered by staff</Li>
                <Li>Sending in-platform notifications about appointments and outstanding investigations</Li>
                <Li>Enforcing role-based access to ensure each staff member sees only the data their role requires</Li>
                <Li>Maintaining the audit log so access to records is always attributable and reviewable</Li>
                <Li>Diagnosing platform errors and improving system performance</Li>
              </Ul>
              <P>
                We do not sell patient data or staff data to any third party. We do not use
                patient health records for advertising, profiling outside the platform, or any
                purpose beyond the delivery of the RF Health service.
              </P>
            </SectionCard>

            {/* 4. Role-based access */}
            <SectionCard id="role-access" icon={<Users size={16} strokeWidth={1.5} />} title="Role-based access">
              <P>
                Access to data within RF Health is controlled by roles. Each account is assigned
                a role at the hospital level, and each role restricts what data that account can
                view, create, or edit. The platform enforces these restrictions on every request.
              </P>
              <SubHead>Doctor</SubHead>
              <P>
                Can view and edit the full clinical record — EMR, prescriptions, investigation
                orders, surgery notes, and the patient timeline — for patients under their care.
                Can view their own appointment schedule and analytics across their hospitals.
              </P>
              <SubHead>Hospital Administrator</SubHead>
              <P>
                Can manage staff accounts, role assignments, and hospital-level settings. Can
                access operational reports and the audit log for that hospital. Does not have
                clinical editing access unless also assigned a Doctor role.
              </P>
              <SubHead>Front Desk</SubHead>
              <P>
                Can book, cancel, and reschedule appointments. Can register new patients and
                view basic patient demographics for appointment purposes. Cannot view or edit
                clinical notes, prescriptions, or investigation results.
              </P>
              <SubHead>Billing</SubHead>
              <P>
                Can access invoices, payment records, and insurance claim details. Cannot view
                clinical notes or prescriptions beyond what is required for billing.
              </P>
              <Note>
                Roles are assigned per hospital. A user who works across two hospitals may have
                different roles at each. Role changes take effect immediately and are recorded
                in the audit log.
              </Note>
            </SectionCard>

            {/* 5. AI processing */}
            <SectionCard id="ai-processing" icon={<RefreshCw size={16} strokeWidth={1.5} />} title="Clinical AI processing">
              <P>
                RF Health includes an optional feature called the{" "}
                <strong className="font-semibold text-emerald-950">Clinical Copilot</strong>.
                It is a decision-support tool, not a diagnostic tool.
              </P>
              <SubHead>What the Clinical Copilot does</SubHead>
              <Ul>
                <Li>Reads the patient record you are currently viewing and produces a concise summary of the clinical history, medications, investigations, and visit timeline</Li>
                <Li>Answers questions you ask about that patient&apos;s record — for example, when a medication was started, or what changed since the last visit</Li>
                <Li>Drafts a consultation note based on the current visit data, returned as a draft for your review</Li>
              </Ul>
              <SubHead>What the Clinical Copilot does not do</SubHead>
              <Ul>
                <Li>It does not write anything to the patient record without the doctor reviewing and explicitly saving it</Li>
                <Li>It does not make diagnoses, prescribe treatments, or replace clinical judgement</Li>
                <Li>It does not share patient data with any AI service beyond the scope of generating the requested output</Li>
              </Ul>
              <SubHead>Opt-in and control</SubHead>
              <P>
                The Clinical Copilot is off by default for every account, including hospital
                administrators. A doctor enables it deliberately for their own account. Even
                after enabling, the Copilot reads only the record currently open — it does not
                run across the full patient database in the background.
              </P>
              <P>
                Patient data sent to the AI processing layer for Copilot requests is used only
                to generate the response for that request. It is not used to train models or
                retained beyond the scope of completing the request.
              </P>
            </SectionCard>

            {/* 6. Third parties */}
            <SectionCard id="third-parties" icon={<ShieldCheck size={16} strokeWidth={1.5} />} title="Third-party services">
              <P>
                RF Health uses third-party infrastructure providers to operate the platform. These
                providers act as data processors under our instructions and are bound by data
                processing agreements that prohibit them from using your data for their own
                purposes.
              </P>
              <SubHead>Infrastructure categories</SubHead>
              <Ul>
                <Li><strong className="font-medium text-emerald-950">Cloud database hosting:</strong> patient records, appointment data, and all structured data are stored in a managed PostgreSQL database hosted on a cloud provider with encryption at rest and automated daily backups.</Li>
                <Li><strong className="font-medium text-emerald-950">Application hosting:</strong> the RF Health web application is deployed on a cloud application platform. Servers are located in a region selected for latency and compliance relevance.</Li>
                <Li><strong className="font-medium text-emerald-950">Email delivery:</strong> transactional emails (account setup, password reset, notifications) are delivered through a third-party email service. No patient health data is included in these emails.</Li>
                <Li><strong className="font-medium text-emerald-950">AI inference:</strong> when the Clinical Copilot is active for a request, relevant portions of the open patient record are sent to an AI inference API to generate the requested output. This is described further in the AI Processing section.</Li>
              </Ul>
              <P>
                We do not share patient data with health insurance aggregators, pharmaceutical
                companies, data brokers, or any party not listed above without explicit consent
                or a legal obligation to do so.
              </P>
            </SectionCard>

            {/* 7. Security */}
            <SectionCard id="security" icon={<Lock size={16} strokeWidth={1.5} />} title="Security">
              <P>
                We implement technical and organisational measures designed to protect personal
                data against unauthorised access, alteration, disclosure, or destruction.
              </P>
              <SubHead>Technical controls</SubHead>
              <Ul>
                <Li>All data in transit is encrypted using TLS. All data at rest is encrypted by the database and storage providers.</Li>
                <Li>Two-factor authentication is available for all accounts and is encouraged for doctor and administrator accounts.</Li>
                <Li>Session tokens are rotated on authentication events and expire after inactivity.</Li>
                <Li>Every access to and edit of a patient record is written to an immutable audit log. The log records the user account, the action, the patient identifier, and the timestamp. It cannot be edited or deleted by any user within the platform, including administrators.</Li>
                <Li>Role-based access control is enforced at the server level on every API request, not only in the user interface.</Li>
                <Li>The database is backed up automatically every day. Backups are stored separately from the primary database and are tested periodically.</Li>
              </Ul>
              <SubHead>Organisational controls</SubHead>
              <Ul>
                <Li>Access to production infrastructure is restricted to a small number of authorised personnel.</Li>
                <Li>We review access grants periodically and revoke access that is no longer needed.</Li>
              </Ul>
              <Note>
                No system is completely immune to security incidents. If we become aware of a
                breach affecting your data, we will notify you as required by applicable law.
                See the Data Breaches section for our notification process.
              </Note>
            </SectionCard>

            {/* 8. Retention */}
            <SectionCard id="retention" icon={<Trash2 size={16} strokeWidth={1.5} />} title="Data retention & deletion">
              <SubHead>Active accounts</SubHead>
              <P>
                Patient records, appointment history, prescriptions, and all clinical data are
                retained for as long as the doctor or hospital account that holds them is active.
                Medical records may be required to be retained for specified periods under
                applicable Indian law (including the Clinical Establishments Act and state-level
                regulations), and we will retain data in compliance with those obligations even
                if an account is closed.
              </P>
              <SubHead>Account closure</SubHead>
              <P>
                When a doctor or hospital account is closed, the account holder may request
                export of the patient data before closure. We will provide a structured export
                in a machine-readable format on request. After the applicable legal retention
                period has elapsed, personal data that is no longer required will be deleted or
                anonymised.
              </P>
              <SubHead>Audit logs</SubHead>
              <P>
                Audit logs are retained for the duration of the account and for a period
                thereafter as required by law or as necessary to resolve disputes or
                investigate security incidents.
              </P>
              <SubHead>Requesting deletion</SubHead>
              <P>
                Individual data principals may request erasure of their personal data by
                contacting us at the address in the Grievance &amp; Contact section. We will
                process the request subject to any legal retention obligation that prevents
                deletion — for example, retention requirements that apply to medical records
                under Indian law.
              </P>
            </SectionCard>

            {/* 9. Your rights */}
            <SectionCard id="your-rights" icon={<ShieldCheck size={16} strokeWidth={1.5} />} title="Your rights">
              <P>
                Under the Digital Personal Data Protection Act, 2023 and other applicable law,
                you have the following rights with respect to your personal data:
              </P>
              <SubHead>Right to access</SubHead>
              <P>
                You may request a summary of the personal data we hold about you, the
                purposes for which it is processed, and the categories of third parties with
                whom it has been shared.
              </P>
              <SubHead>Right to correction</SubHead>
              <P>
                You may request correction of personal data that is inaccurate or incomplete.
                For patient clinical records, corrections should be requested through the
                treating doctor or the hospital that holds the record, who can update the
                record within the platform.
              </P>
              <SubHead>Right to erasure</SubHead>
              <P>
                You may request deletion of personal data that is no longer necessary for the
                purpose it was collected, subject to legal retention obligations described above.
              </P>
              <SubHead>Right to withdraw consent</SubHead>
              <P>
                Where processing is based on consent — for example, use of the Clinical Copilot
                feature — you may withdraw consent at any time. Withdrawal does not affect the
                lawfulness of processing carried out before withdrawal.
              </P>
              <SubHead>Right to grievance redressal</SubHead>
              <P>
                You may raise a grievance about how your data is handled. We will acknowledge
                your grievance and respond within 30 days. Details are in the Grievance &amp;
                Contact section.
              </P>
              <SubHead>Right to nominate</SubHead>
              <P>
                Under the DPDP Act, you may nominate another individual to exercise your data
                rights on your behalf in the event of your death or incapacity.
              </P>
              <P>
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:support@ppmsai.com" className="font-medium text-emerald-700 underline-offset-3 hover:underline">
                  support@ppmsai.com
                </a>.
                We may ask you to verify your identity before acting on a request.
              </P>
            </SectionCard>

            {/* 10. Cookies */}
            <SectionCard id="cookies" icon={<Lock size={16} strokeWidth={1.5} />} title="Cookies & sessions">
              <P>
                RF Health uses cookies and similar technologies to maintain user sessions and
                ensure the platform functions correctly.
              </P>
              <SubHead>Session cookies</SubHead>
              <P>
                When you sign in, a session token is set in a secure, HTTP-only cookie. This
                token identifies your session and is required for the platform to function. It
                expires when you sign out or after a period of inactivity. No session cookie
                contains health data.
              </P>
              <SubHead>What we do not use</SubHead>
              <P>
                We do not place third-party advertising cookies, analytics tracking cookies
                from advertising networks, or any cookie designed to track you across other
                websites. We do not use fingerprinting or other non-cookie tracking techniques.
              </P>
              <SubHead>Managing cookies</SubHead>
              <P>
                The session cookie is essential for the platform to work. Blocking it will
                prevent sign-in. You can sign out at any time to invalidate your session cookie.
              </P>
            </SectionCard>

            {/* 11. Data breach */}
            <SectionCard id="data-breach" icon={<AlertCircle size={16} strokeWidth={1.5} />} title="Data breaches">
              <P>
                Despite the controls described in the Security section, no system can guarantee
                complete protection against all threats. In the event that we become aware of a
                personal data breach:
              </P>
              <Ul>
                <Li>We will assess the breach promptly to determine its scope and risk.</Li>
                <Li>Where the breach is likely to result in a risk to the rights of affected data principals, we will notify the relevant regulatory authority as required by the DPDP Act, 2023 and any other applicable law.</Li>
                <Li>Where the breach is likely to result in a high risk to affected individuals, we will notify those individuals directly, including a description of what data was affected and what steps they can take.</Li>
                <Li>We will take steps to contain the breach, assess the cause, and implement measures to prevent recurrence.</Li>
              </Ul>
              <P>
                If you believe your account has been compromised, contact us immediately at{" "}
                <a href="mailto:support@ppmsai.com" className="font-medium text-emerald-700 underline-offset-3 hover:underline">
                  support@ppmsai.com
                </a>.
              </P>
            </SectionCard>

            {/* 12. DPDP */}
            <SectionCard id="dpdp" icon={<FileText size={16} strokeWidth={1.5} />} title="Digital Personal Data Protection Act, 2023">
              <P>
                RF Health is operated in India and processes data of persons in India. The
                Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;) applies to
                the personal data we process.
              </P>
              <SubHead>Data fiduciary</SubHead>
              <P>
                RAPDFLY PRIVATE LIMITED is the Data Fiduciary for the personal data processed
                through RF Health. We determine the purpose and means of processing and are
                responsible for compliance with the DPDP Act.
              </P>
              <SubHead>Lawful basis for processing</SubHead>
              <P>We process personal data on the following bases:</P>
              <Ul>
                <Li><strong className="font-medium text-emerald-950">Consent:</strong> for the processing of patient data entered by the treating doctor or healthcare facility, and for optional features such as the Clinical Copilot.</Li>
                <Li><strong className="font-medium text-emerald-950">Legitimate uses:</strong> for security and fraud prevention, compliance with legal obligations, and operation of the platform that the user has contracted for.</Li>
              </Ul>
              <SubHead>Data localisation</SubHead>
              <P>
                We store patient data on infrastructure hosted within a region consistent with
                our operational and compliance requirements. We will update this policy if our
                storage location changes in a way that affects your rights.
              </P>
              <SubHead>Consent notices</SubHead>
              <P>
                Where we rely on consent as the lawful basis for processing, we provide clear
                notice of the data being collected and the purpose. You may withdraw consent
                at any time without affecting the lawfulness of prior processing.
              </P>
              <SubHead>Grievance officer</SubHead>
              <P>
                As required by the DPDP Act, we have designated a point of contact for data
                principal grievances. Details are in the Grievance &amp; Contact section below.
              </P>
              <Note>
                The DPDP Act, 2023 is India&apos;s primary legislation governing the processing
                of digital personal data. Additional sector-specific obligations may apply to
                healthcare providers using RF Health under the Clinical Establishments Act, the
                Information Technology Act, and applicable state laws. Healthcare providers are
                responsible for their own compliance with those obligations.
              </Note>
            </SectionCard>

            {/* 13. Children */}
            <SectionCard id="children" icon={<Users size={16} strokeWidth={1.5} />} title="Children's data">
              <P>
                RF Health may process medical records of minor patients where a treating doctor
                or hospital registers and manages the child&apos;s record as part of clinical care.
                In such cases, the data is entered by the healthcare provider and is subject to
                the same protections as all other patient data.
              </P>
              <P>
                RF Health does not offer direct accounts to persons under 18. If we become aware
                that a minor has independently registered an account, we will delete that account
                promptly.
              </P>
            </SectionCard>

            {/* 14. Changes */}
            <SectionCard id="changes" icon={<History size={16} strokeWidth={1.5} />} title="Changes to this policy">
              <P>
                We may update this Privacy Policy from time to time to reflect changes in the
                platform, applicable law, or our practices. When we make material changes, we
                will notify active account holders by email or through an in-platform notice at
                least 14 days before the change takes effect, where practicable.
              </P>
              <P>
                The &quot;Last updated&quot; date at the top of this page shows when the policy
                was last revised. Continued use of RF Health after the effective date of a change
                constitutes acceptance of the updated policy.
              </P>
            </SectionCard>

            {/* 15. Grievance */}
            <SectionCard id="contact" icon={<Mail size={16} strokeWidth={1.5} />} title="Grievance & contact">
              <P>
                If you have a question, concern, or complaint about how we handle your personal
                data, or if you wish to exercise any of your rights under the DPDP Act, contact us:
              </P>

              <div className="mt-4 rounded-xl bg-emerald-50/70 ring-1 ring-inset ring-emerald-950/[0.07] overflow-hidden lg:rounded-2xl">
                <div className="px-5 py-4 border-b border-emerald-950/[0.06]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Grievance Officer / Data Fiduciary Contact
                  </p>
                </div>
                <div className="px-5 py-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
                  <div className="flex items-start gap-3 text-[14px] text-slate-700 sm:text-[14.5px]">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-inset ring-emerald-950/[0.07]">
                      <FileText size={13} strokeWidth={1.5} />
                    </span>
                    <span><strong className="font-semibold text-emerald-950">RAPDFLY PRIVATE LIMITED</strong></span>
                  </div>
                  <a
                    href="mailto:support@ppmsai.com"
                    className="flex items-center gap-3 text-[14px] text-emerald-700 hover:underline underline-offset-3 sm:text-[14.5px]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-inset ring-emerald-950/[0.07]">
                      <Mail size={13} strokeWidth={1.5} />
                    </span>
                    support@ppmsai.com
                  </a>
                  <a
                    href="tel:+917373351087"
                    className="flex items-center gap-3 text-[14px] text-slate-700 hover:text-emerald-800 sm:text-[14.5px]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-inset ring-emerald-950/[0.07]">
                      <Phone size={13} strokeWidth={1.5} />
                    </span>
                    +91 73733 51087
                  </a>
                  <div className="flex items-start gap-3 text-[14px] text-slate-600 sm:text-[14.5px]">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-inset ring-emerald-950/[0.07]">
                      <MapPin size={13} strokeWidth={1.5} />
                    </span>
                    <span>Bangalore, Karnataka, India</span>
                  </div>
                </div>
              </div>

              <P>
                We will acknowledge your grievance within 7 business days and aim to resolve
                it within 30 days. If your grievance is not resolved to your satisfaction, you
                may escalate it to the Data Protection Board of India once it is established
                under the DPDP Act, 2023.
              </P>
            </SectionCard>

          </div>{/* end policy content */}
        </div>{/* end flex row */}
      </div>{/* end body container */}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-emerald-950/[0.07] bg-white">
        <div className="mx-auto w-[min(92%,1760px)] py-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[13px] text-slate-400">
          <p>© {new Date().getFullYear()} RAPDFLY PRIVATE LIMITED. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="/" className="hover:text-emerald-800 transition-colors">Home</a>
            <a href="/privacy" className="font-medium text-emerald-700">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
