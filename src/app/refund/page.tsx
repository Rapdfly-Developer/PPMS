import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "@/components/landing/Nav";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import {
  Mail, Phone, MapPin, FileText, CreditCard, Clock,
  CheckCircle, XCircle, RefreshCw, AlertCircle, ArrowLeft,
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
  title: "Refund Policy · RF Health",
  description:
    "Refund Policy for RF Health by RAPDFLY PRIVATE LIMITED. Understand our refund and cancellation terms for subscription payments.",
  alternates: { canonical: "/refund" },
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

export default function RefundPage() {
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
            Refund Policy
          </h1>
          <p className="mt-3 max-w-[min(100%,72ch)] text-[clamp(13.5px,1.5vw,15.5px)] leading-relaxed text-slate-500">
            This policy explains our approach to refunds and cancellations for RF Health
            subscriptions, operated by{" "}
            <strong className="font-semibold text-emerald-950">RAPDFLY PRIVATE LIMITED</strong>.
          </p>
          <p className="mt-3 text-[13px] text-slate-400">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto w-[min(92%,1760px)] py-8 sm:py-10 lg:py-12 2xl:py-14">
        <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">

          {/* 1. Overview */}
          <SectionCard id="overview" icon={<FileText size={16} strokeWidth={1.5} />} title="Overview">
            <P>
              We want you to be satisfied with RF Health. This policy sets out the circumstances
              under which refunds may be issued for subscription payments made to RAPDFLY PRIVATE
              LIMITED. Please read it carefully before subscribing.
            </P>
            <P>
              All payments are processed securely through Razorpay. Refunds, where approved, are
              returned to the original payment method.
            </P>
            <Note>
              If you have a payment dispute or have been charged in error, contact us at{" "}
              <a href="mailto:support@ppmsai.com" className="font-medium text-emerald-700 underline-offset-3 hover:underline">support@ppmsai.com</a>{" "}
              before initiating a chargeback with your bank. We resolve billing issues promptly
              and a chargeback may delay resolution.
            </Note>
          </SectionCard>

          {/* 2. Free trial */}
          <SectionCard id="trial" icon={<Clock size={16} strokeWidth={1.5} />} title="Free trial period">
            <P>
              RF Health offers a <strong className="font-semibold text-emerald-950">7-day free trial</strong>{" "}
              to all new accounts. During the trial you have full access to all platform features.
              No payment is required to start a trial.
            </P>
            <P>
              Because no charge is made during the trial period, there is nothing to refund.
              If you wish to stop using RF Health during the trial, simply do not subscribe;
              no action is required and no charge will be made.
            </P>
          </SectionCard>

          {/* 3. Subscription payments */}
          <SectionCard id="subscriptions" icon={<CreditCard size={16} strokeWidth={1.5} />} title="Subscription payments">
            <SubHead>Monthly plans</SubHead>
            <P>
              Monthly subscriptions are billed every 30 days from the date of activation. Each
              billing period provides access to all features in your chosen plan for that period.
            </P>
            <SubHead>Annual plans</SubHead>
            <P>
              Annual subscriptions are billed once per year and provide access to the platform
              for a full 12-month period from the date of activation. Annual plans are offered
              at a discounted rate compared to equivalent monthly billing.
            </P>
            <SubHead>General rule</SubHead>
            <P>
              Subscription fees are <strong className="font-semibold text-emerald-950">non-refundable</strong>{" "}
              as a general rule. Once a billing period begins and you have access to the
              platform, the subscription fee for that period is considered earned. We do not
              provide pro-rata refunds for unused time within a paid billing period.
            </P>
          </SectionCard>

          {/* 4. Refund eligibility */}
          <SectionCard id="eligibility" icon={<CheckCircle size={16} strokeWidth={1.5} />} title="When refunds are issued">
            <P>
              Notwithstanding the general non-refundable rule, we will issue a refund in the
              following circumstances:
            </P>
            <SubHead>Duplicate charge</SubHead>
            <P>
              If you were charged more than once for the same billing period due to a technical
              error, we will refund the duplicate charge in full within 7 business days of
              verification.
            </P>
            <SubHead>Charge after cancellation</SubHead>
            <P>
              If you were charged after successfully cancelling your subscription, and we can
              confirm that the cancellation was processed before the charge, we will refund
              that charge in full.
            </P>
            <SubHead>Significant service failure</SubHead>
            <P>
              If RF Health experiences extended, unplanned downtime or a material failure that
              prevents you from using the platform for more than{" "}
              <strong className="font-semibold text-emerald-950">72 consecutive hours</strong>{" "}
              in a single billing period, and the failure is on our side (not due to your
              infrastructure, network, or browser), you may request a pro-rata credit or partial
              refund for the affected period. Such requests are reviewed on a case-by-case basis.
            </P>
            <SubHead>Annual plan: first 7 days</SubHead>
            <P>
              If you subscribed to an annual plan and wish to cancel within{" "}
              <strong className="font-semibold text-emerald-950">7 days</strong> of your first
              annual payment (not a renewal), and you have not made substantial use of the
              platform (for example, not entered more than 10 patient records), you may request
              a full refund. This grace period is available once per customer.
            </P>
          </SectionCard>

          {/* 5. Non-refundable */}
          <SectionCard id="non-refundable" icon={<XCircle size={16} strokeWidth={1.5} />} title="What is not refundable">
            <P>The following are not eligible for a refund:</P>
            <Ul>
              <Li>Monthly subscription fees once the billing period has started, except in the circumstances listed above.</Li>
              <Li>Annual subscription fees after 7 days from the first payment, or if substantial use has been made of the platform during that period.</Li>
              <Li>Renewal charges for annual plans, which are treated as monthly subscriptions for refund purposes once renewed.</Li>
              <Li>Fees for periods during which you had full access to the platform but chose not to use it.</Li>
              <Li>Fees for accounts that were suspended due to a breach of our <a href="/terms" className="font-medium text-emerald-700 underline-offset-3 hover:underline">Terms of Service</a>.</Li>
              <Li>Transaction fees or payment processing charges imposed by Razorpay, which are outside our control.</Li>
            </Ul>
          </SectionCard>

          {/* 6. Cancellation vs refund */}
          <SectionCard id="cancellation" icon={<RefreshCw size={16} strokeWidth={1.5} />} title="Cancellation vs. refund">
            <P>
              Cancellation and refund are two separate actions:
            </P>
            <SubHead>Cancellation</SubHead>
            <P>
              You can cancel your subscription at any time from the Settings page in your RF
              Health account. Cancellation stops future charges. Your access to paid features
              continues until the end of the current billing period; you do not lose access
              immediately on cancellation. No refund is issued automatically on cancellation
              (see eligibility above).
            </P>
            <SubHead>Refund request</SubHead>
            <P>
              A refund request is a separate step. If you believe you are eligible for a refund
              under the circumstances listed in this policy, you must contact us and request it.
              Cancelling your subscription alone does not trigger a refund.
            </P>
            <Note>
              We recommend cancelling your subscription first (to prevent future charges), and
              then contacting us to request a refund if you believe you are eligible.
            </Note>
          </SectionCard>

          {/* 7. How to request */}
          <SectionCard id="how-to-request" icon={<Mail size={16} strokeWidth={1.5} />} title="How to request a refund">
            <P>
              To request a refund, email us at{" "}
              <a href="mailto:support@ppmsai.com" className="font-medium text-emerald-700 underline-offset-3 hover:underline">support@ppmsai.com</a>{" "}
              with the subject line <strong className="font-semibold text-emerald-950">&quot;Refund Request&quot;</strong> and include:
            </P>
            <Ul>
              <Li>The email address associated with your RF Health account.</Li>
              <Li>The date of the charge you are requesting a refund for.</Li>
              <Li>The reason for your refund request, referencing the applicable circumstance from this policy.</Li>
              <Li>Any supporting information (for example, a screenshot of a duplicate charge).</Li>
            </Ul>
            <SubHead>Processing timeline</SubHead>
            <P>
              We will acknowledge your request within{" "}
              <strong className="font-semibold text-emerald-950">2 business days</strong> and
              aim to issue a decision within{" "}
              <strong className="font-semibold text-emerald-950">7 business days</strong> of
              receiving all required information.
            </P>
            <P>
              If approved, refunds are processed through Razorpay back to the original payment
              method. The time for funds to appear in your account depends on your bank and
              typically takes 5–10 business days after we initiate the refund.
            </P>
          </SectionCard>

          {/* 8. Payment failures */}
          <SectionCard id="payment-failures" icon={<AlertCircle size={16} strokeWidth={1.5} />} title="Payment failures">
            <P>
              If a payment fails (for example, due to an expired card or insufficient funds),
              your access to paid features may be temporarily suspended. No charge is made for
              a failed payment.
            </P>
            <P>
              To restore access, update your payment method and complete the payment. If you
              believe a payment failure was due to a technical error on our side rather than
              your payment method, contact us and we will investigate.
            </P>
          </SectionCard>

          {/* 9. Changes */}
          <SectionCard id="changes" icon={<RefreshCw size={16} strokeWidth={1.5} />} title="Changes to this policy">
            <P>
              We may update this Refund Policy from time to time. When we make material changes,
              we will notify active account holders by email or through an in-platform notice at
              least 14 days before the change takes effect.
            </P>
            <P>
              The &quot;Last updated&quot; date at the top of this page shows when the policy was
              last revised. The version of this policy in effect at the time of your payment
              governs refund eligibility for that payment.
            </P>
          </SectionCard>

          {/* 10. Contact */}
          <SectionCard id="contact" icon={<Mail size={16} strokeWidth={1.5} />} title="Contact">
            <P>
              For any billing or refund questions, contact us:
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
            <a href="/terms" className="hover:text-emerald-800 transition-colors">Terms of Service</a>
            <a href="/refund" className="font-medium text-emerald-700">Refund Policy</a>
            <CookieSettingsButton className="hover:text-emerald-800 transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
