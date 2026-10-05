import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "@/components/landing/Nav";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import {
  Mail, Phone, MapPin, FileText, ShieldCheck, CreditCard,
  Users, AlertCircle, Scale, Ban, RefreshCw, BookOpen, Building2, ArrowLeft,
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
  title: "Terms of Service · RF Health",
  description:
    "Terms of Service for RF Health by RAPDFLY PRIVATE LIMITED. Read the terms governing your use of the RF Health practice management platform.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "28 September 2026";

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

export default function TermsPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} font-body min-h-screen bg-slate-50/50 text-emerald-950 antialiased`}
    >
      <Nav />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-emerald-950/[0.07] bg-white">
        <div className="mx-auto w-[min(92%,1760px)] pt-24 pb-8 sm:pt-28 sm:pb-10 lg:pt-32 lg:pb-12 2xl:pt-36 2xl:pb-14">
          <div className="mb-6">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors duration-150 hover:text-emerald-700"
            >
              <ArrowLeft size={13} strokeWidth={2} />
              Back to Home
            </a>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/[0.08] bg-emerald-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Legal
          </span>
          <h1 className="font-display mt-4 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-emerald-950">
            Terms of Service
          </h1>
          <p className="mt-3 max-w-[min(100%,72ch)] text-[clamp(13.5px,1.5vw,15.5px)] leading-relaxed text-slate-500">
            These Terms of Service govern your use of RF Health, operated by{" "}
            <strong className="font-semibold text-emerald-950">RAPDFLY PRIVATE LIMITED</strong>.
            By accessing or using the platform, you agree to be bound by these terms.
          </p>
          <p className="mt-3 text-[13px] text-slate-400">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto w-[min(92%,1760px)] py-8 sm:py-10 lg:py-12 2xl:py-14">
        <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">

          {/* 1. Agreement */}
          <SectionCard id="agreement" icon={<FileText size={16} strokeWidth={1.5} />} title="Agreement to these terms">
            <P>
              By creating an account, subscribing to a plan, or using any part of RF Health, you
              confirm that you have read, understood, and agreed to these Terms of Service and our{" "}
              <a href="/privacy" className="font-medium text-emerald-700 underline-offset-3 hover:underline">Privacy Policy</a>.
            </P>
            <P>
              If you are using RF Health on behalf of a hospital, clinic, or other organisation,
              you represent that you have the authority to bind that organisation to these terms.
              In that case, &quot;you&quot; refers to both you and that organisation.
            </P>
            <P>
              If you do not agree to these terms, do not access or use RF Health. We reserve the
              right to update these terms at any time. Continued use after the effective date of
              a change constitutes acceptance of the updated terms.
            </P>
            <Note>
              These terms are governed by the laws of India. Any dispute arising out of or in
              connection with these terms shall be subject to the exclusive jurisdiction of the
              courts of Bangalore, Karnataka.
            </Note>
          </SectionCard>

          {/* 2. The Service */}
          <SectionCard id="service" icon={<BookOpen size={16} strokeWidth={1.5} />} title="The service">
            <P>
              RF Health is a cloud-based practice management platform for doctors and healthcare
              facilities. It provides tools for patient record management, appointment scheduling,
              prescription generation, clinical documentation, analytics, and related functions.
            </P>
            <SubHead>Nature of the service</SubHead>
            <P>
              RF Health is a software tool to support healthcare administration and documentation.
              It is <strong className="font-semibold text-emerald-950">not a medical device</strong>,
              does not provide medical advice, and does not replace the clinical judgement of a
              qualified healthcare professional. Any AI-assisted features are decision-support
              tools only.
            </P>
            <SubHead>Service availability</SubHead>
            <P>
              We aim to provide a reliable, available service but do not guarantee uninterrupted
              access. We may perform maintenance, upgrades, or emergency fixes that temporarily
              affect availability. We will endeavour to provide advance notice of planned downtime.
            </P>
            <SubHead>Changes to the service</SubHead>
            <P>
              We may add, modify, or discontinue features of RF Health at any time. Where we
              discontinue a material feature that subscribers rely on, we will provide at least
              30 days&apos; notice where practicable.
            </P>
          </SectionCard>

          {/* 3. Accounts */}
          <SectionCard id="accounts" icon={<Users size={16} strokeWidth={1.5} />} title="Account registration">
            <P>
              To use RF Health, you must create an account using a valid email address. You are
              responsible for maintaining the confidentiality of your login credentials and for
              all activity that occurs under your account.
            </P>
            <SubHead>Account security</SubHead>
            <Ul>
              <Li>You must not share your login credentials with any other person.</Li>
              <Li>You must notify us immediately at <a href="mailto:support@ppmsai.com" className="font-medium text-emerald-700 underline-offset-3 hover:underline">support@ppmsai.com</a> if you become aware of any unauthorised access to your account.</Li>
              <Li>We recommend enabling two-factor authentication, which is available on all accounts.</Li>
              <Li>We are not liable for any loss or damage arising from your failure to keep your credentials secure.</Li>
            </Ul>
            <SubHead>Accurate information</SubHead>
            <P>
              You must provide accurate and complete information when registering your account
              and keep it up to date. Providing false or misleading information may result in
              immediate account suspension.
            </P>
            <SubHead>Staff and sub-accounts</SubHead>
            <P>
              If you create accounts for staff members (front desk, billing, other doctors), you
              are responsible for ensuring those users comply with these terms and are aware of
              applicable policies, including the Privacy Policy.
            </P>
          </SectionCard>

          {/* 4. Billing */}
          <SectionCard id="billing" icon={<CreditCard size={16} strokeWidth={1.5} />} title="Subscription & billing">
            <SubHead>Plans and pricing</SubHead>
            <P>
              RF Health is offered on subscription plans. Current plan pricing is displayed at{" "}
              <a href="/#pricing" className="font-medium text-emerald-700 underline-offset-3 hover:underline">ppmsai.com/#pricing</a>{" "}
              and at checkout. All prices are in Indian Rupees (INR) and inclusive of applicable
              taxes unless stated otherwise.
            </P>
            <SubHead>Free trial</SubHead>
            <P>
              New accounts receive a 7-day free trial with full access to platform features. No
              payment is required to start the trial. At the end of the trial period, access
              continues on a read-only basis until a paid plan is activated, or the account is
              closed.
            </P>
            <SubHead>Payment processing</SubHead>
            <P>
              Payments are processed by Razorpay (Razorpay Software Private Limited), a
              third-party payment gateway. By making a payment, you also agree to Razorpay&apos;s
              terms of service. We do not store payment card numbers. Payment failures may result
              in a temporary suspension of access to paid features until the payment is resolved.
            </P>
            <SubHead>Billing cycle</SubHead>
            <Ul>
              <Li>Monthly plans are billed every 30 days from the date of activation.</Li>
              <Li>Annual plans are billed once per year from the date of activation.</Li>
              <Li>Subscription fees are non-refundable except as described in our <a href="/refund" className="font-medium text-emerald-700 underline-offset-3 hover:underline">Refund Policy</a>.</Li>
            </Ul>
            <SubHead>Cancellation</SubHead>
            <P>
              You may cancel your subscription at any time from the Settings page in your
              account. On cancellation, your access to paid features continues until the end of
              the current billing period. No further charges are made after cancellation. See
              our <a href="/refund" className="font-medium text-emerald-700 underline-offset-3 hover:underline">Refund Policy</a> for refund eligibility.
            </P>
            <SubHead>Price changes</SubHead>
            <P>
              We may change subscription pricing. We will give at least 30 days&apos; notice of
              any price increase to existing subscribers. A price change does not affect the
              current billing period for which you have already paid.
            </P>
          </SectionCard>

          {/* 5. Acceptable use */}
          <SectionCard id="acceptable-use" icon={<ShieldCheck size={16} strokeWidth={1.5} />} title="Acceptable use">
            <P>You agree to use RF Health only for lawful purposes and in compliance with these terms. You must not:</P>
            <Ul>
              <Li>Use the platform to store or process data that you do not have the right or lawful authority to process, including patient data obtained without proper consent.</Li>
              <Li>Attempt to gain unauthorised access to any account, system, or data within the platform.</Li>
              <Li>Use the platform to violate any applicable law or regulation, including those relating to healthcare data, privacy, or professional practice.</Li>
              <Li>Reverse-engineer, decompile, or attempt to extract the source code of any part of RF Health.</Li>
              <Li>Transmit malware, viruses, or any other harmful code through the platform.</Li>
              <Li>Use any automated system (bots, scrapers, crawlers) to access or extract data from the platform without our prior written consent.</Li>
              <Li>Misrepresent your identity, qualifications, or affiliation when using the platform.</Li>
              <Li>Use the platform in any way that could damage, overburden, or impair its infrastructure or interfere with other users&apos; access.</Li>
            </Ul>
            <Note>
              Any violation of these acceptable use terms may result in immediate suspension or
              termination of your account without notice. We reserve the right to report violations
              to relevant regulatory or law-enforcement authorities where required.
            </Note>
          </SectionCard>

          {/* 6. Healthcare obligations */}
          <SectionCard id="healthcare" icon={<Building2 size={16} strokeWidth={1.5} />} title="Healthcare provider obligations">
            <P>
              RF Health is used by licensed healthcare professionals and facilities. By using the
              platform, you represent and warrant that:
            </P>
            <Ul>
              <Li>You hold all required licences, registrations, and permissions to practice medicine or manage a healthcare facility in your jurisdiction.</Li>
              <Li>You have obtained, and will maintain, all necessary consents from patients whose data you enter into the platform, as required by applicable law including the Digital Personal Data Protection Act, 2023.</Li>
              <Li>You will use clinical data entered into the platform only for lawful purposes related to patient care and practice management.</Li>
              <Li>You will not enter patient data into the platform that you do not have the right to process.</Li>
              <Li>You understand that RF Health is an administrative tool and that all clinical decisions remain your sole professional responsibility.</Li>
            </Ul>
            <SubHead>Data ownership</SubHead>
            <P>
              Patient records and clinical data that you enter into RF Health remain yours. We
              process this data on your behalf as described in our Privacy Policy. We do not
              claim ownership of your patient data and will make it available for export on
              request.
            </P>
          </SectionCard>

          {/* 7. Intellectual property */}
          <SectionCard id="ip" icon={<BookOpen size={16} strokeWidth={1.5} />} title="Intellectual property">
            <SubHead>Our IP</SubHead>
            <P>
              RF Health, including its software, design, trademarks, and all content we create,
              is the property of RAPDFLY PRIVATE LIMITED and is protected by applicable
              intellectual property laws. These terms do not grant you any ownership rights in
              the platform.
            </P>
            <SubHead>Your licence to use the platform</SubHead>
            <P>
              Subject to these terms and payment of applicable fees, we grant you a limited,
              non-exclusive, non-transferable, revocable licence to access and use RF Health for
              your internal practice management purposes.
            </P>
            <SubHead>Your content</SubHead>
            <P>
              You retain all ownership rights in the data, records, and content you enter into
              the platform. By entering data into RF Health, you grant us a limited licence to
              process that data solely for the purpose of providing the service to you.
            </P>
          </SectionCard>

          {/* 8. Disclaimers */}
          <SectionCard id="disclaimers" icon={<AlertCircle size={16} strokeWidth={1.5} />} title="Disclaimers">
            <P>
              RF Health is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, either express or implied, to the fullest extent permitted
              by applicable law. We do not warrant that:
            </P>
            <Ul>
              <Li>The platform will be error-free, uninterrupted, or free of harmful components.</Li>
              <Li>The results obtained through use of the platform will be accurate or reliable.</Li>
              <Li>Any defects will be corrected within a specific timeframe.</Li>
            </Ul>
            <P>
              RF Health does not provide medical, clinical, legal, or financial advice. Any
              AI-generated content (summaries, draft notes, suggestions) is for informational
              purposes only and must be reviewed by a qualified professional before any reliance
              or clinical action. Clinical decisions remain entirely the responsibility of the
              treating healthcare provider.
            </P>
          </SectionCard>

          {/* 9. Limitation of liability */}
          <SectionCard id="liability" icon={<Scale size={16} strokeWidth={1.5} />} title="Limitation of liability">
            <P>
              To the fullest extent permitted by applicable law, RAPDFLY PRIVATE LIMITED shall
              not be liable for any indirect, incidental, special, consequential, or punitive
              damages, including but not limited to loss of profits, data, goodwill, or other
              intangible losses, arising from:
            </P>
            <Ul>
              <Li>Your access to, use of, or inability to access or use the platform.</Li>
              <Li>Any clinical decision made in reliance on data or outputs from the platform.</Li>
              <Li>Unauthorised access to or alteration of your data, provided we have complied with our security obligations.</Li>
              <Li>Any third-party content, services, or systems integrated with or accessed through the platform.</Li>
            </Ul>
            <P>
              In no event shall our total liability to you for all claims exceed the total
              amount you paid to us in the twelve months immediately preceding the event giving
              rise to the claim.
            </P>
            <Note>
              Some jurisdictions do not permit the exclusion or limitation of certain warranties
              or liabilities. If applicable law in your jurisdiction does not permit these
              exclusions or limitations, they apply to the maximum extent permitted by law.
            </Note>
          </SectionCard>

          {/* 10. Termination */}
          <SectionCard id="termination" icon={<Ban size={16} strokeWidth={1.5} />} title="Termination">
            <SubHead>Termination by you</SubHead>
            <P>
              You may close your account at any time by contacting us at{" "}
              <a href="mailto:support@ppmsai.com" className="font-medium text-emerald-700 underline-offset-3 hover:underline">support@ppmsai.com</a>.
              You may request export of your data before closing your account. Once the account
              is closed, your data will be retained only as required by law and then deleted in
              accordance with our Privacy Policy.
            </P>
            <SubHead>Termination by us</SubHead>
            <P>
              We may suspend or terminate your account immediately and without prior notice if:
            </P>
            <Ul>
              <Li>You breach any provision of these terms.</Li>
              <Li>Your account is used in a manner that poses a risk to the platform, other users, or patient data.</Li>
              <Li>You fail to pay subscription fees after a reasonable grace period.</Li>
              <Li>We are required to do so by applicable law or a regulatory authority.</Li>
            </Ul>
            <P>
              Where termination is not due to a breach on your part, we will provide at least
              30 days&apos; notice where practicable and will provide data export assistance.
            </P>
            <SubHead>Effect of termination</SubHead>
            <P>
              On termination, your licence to use the platform ends immediately. Provisions of
              these terms that by their nature should survive termination, including disclaimers,
              limitation of liability, and governing law, will continue to apply.
            </P>
          </SectionCard>

          {/* 11. Governing law */}
          <SectionCard id="governing-law" icon={<Scale size={16} strokeWidth={1.5} />} title="Governing law & disputes">
            <P>
              These Terms of Service are governed by and construed in accordance with the laws
              of India, without regard to its conflict of law provisions.
            </P>
            <SubHead>Dispute resolution</SubHead>
            <P>
              In the event of a dispute, we encourage you to contact us first at{" "}
              <a href="mailto:support@ppmsai.com" className="font-medium text-emerald-700 underline-offset-3 hover:underline">support@ppmsai.com</a>{" "}
              so we can attempt to resolve the matter informally. If informal resolution is not
              possible, any dispute arising out of or relating to these terms shall be subject
              to the exclusive jurisdiction of the courts of Bangalore, Karnataka, India.
            </P>
          </SectionCard>

          {/* 12. Changes */}
          <SectionCard id="changes" icon={<RefreshCw size={16} strokeWidth={1.5} />} title="Changes to these terms">
            <P>
              We may update these Terms of Service from time to time. When we make material
              changes, we will notify active account holders by email or through an in-platform
              notice at least 14 days before the change takes effect, where practicable.
            </P>
            <P>
              The &quot;Last updated&quot; date at the top of this page shows when the terms
              were last revised. Continued use of RF Health after the effective date of a change
              constitutes acceptance of the updated terms.
            </P>
          </SectionCard>

          {/* 13. Contact */}
          <SectionCard id="contact" icon={<Mail size={16} strokeWidth={1.5} />} title="Contact">
            <P>
              If you have questions about these terms or wish to report a violation, contact us:
            </P>
            <div className="mt-4 rounded-xl bg-emerald-50/70 ring-1 ring-inset ring-emerald-950/[0.07] overflow-hidden lg:rounded-2xl">
              <div className="px-5 py-4 border-b border-emerald-950/[0.06]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  RAPDFLY PRIVATE LIMITED
                </p>
              </div>
              <div className="px-5 py-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
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
          </SectionCard>

        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-emerald-950/[0.07] bg-white">
        <div className="mx-auto w-[min(92%,1760px)] py-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[13px] text-slate-400">
          <p>© {new Date().getFullYear()} RAPDFLY PRIVATE LIMITED. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="/" className="hover:text-emerald-800 transition-colors">Home</a>
            <a href="/privacy" className="hover:text-emerald-800 transition-colors">Privacy Policy</a>
            <a href="/terms" className="font-medium text-emerald-700">Terms of Service</a>
            <a href="/refund" className="hover:text-emerald-800 transition-colors">Refund Policy</a>
            <CookieSettingsButton className="hover:text-emerald-800 transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
