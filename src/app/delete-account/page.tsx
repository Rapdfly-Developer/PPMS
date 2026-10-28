import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "@/components/landing/Nav";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import Link from "next/link";
import { Mail, Phone, Trash2, Database, ArrowLeft } from "lucide-react";

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

// Public account-deletion page: the web link app stores ask for. Accounts are
// created by RF Health administrators, so deletion is a request we process.
export const metadata: Metadata = {
  title: "Delete your account · RF Health",
  description:
    "How to request deletion of your RF Health account and data, what is deleted, and what must be retained by law.",
  alternates: { canonical: "/delete-account" },
  robots: { index: true, follow: true },
};

const MAIL_HREF =
  "mailto:support@ppmsai.com?subject=RF%20Health%20account%20deletion%20request";

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
      className="scroll-mt-28 rounded-xl bg-white p-6 ring-1 ring-inset ring-emerald-950/[0.07] shadow-[0_2px_16px_-6px_rgba(6,60,45,0.06)] sm:p-7 lg:rounded-2xl lg:p-8"
    >
      <div className="flex items-start gap-3 mb-5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/[0.12]">
          {icon}
        </span>
        <h2 className="font-display text-[18px] font-bold tracking-tight text-emerald-950 sm:text-[20px] lg:text-[22px]">
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-relaxed text-slate-600 mb-4 last:mb-0 sm:text-[15px]">
      {children}
    </p>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span>{children}</span>
    </li>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 mb-2 text-[14px] font-semibold tracking-tight text-emerald-950 first:mt-0 sm:text-[15px]">
      {children}
    </h3>
  );
}

export default function DeleteAccountPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} font-body min-h-screen bg-slate-50/50 text-emerald-950 antialiased`}
    >
      <Nav />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-emerald-950/[0.07] bg-white">
        <div className="mx-auto w-[min(92%,960px)] pt-24 pb-8 sm:pt-28 sm:pb-10 lg:pt-32 lg:pb-12">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors duration-150 hover:text-emerald-700"
            >
              <ArrowLeft size={13} strokeWidth={2} />
              Back to Home
            </Link>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/[0.08] bg-emerald-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Account
          </span>
          <h1 className="font-display mt-4 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-emerald-950">
            Delete your RF Health account
          </h1>
          <p className="mt-3 max-w-[min(100%,72ch)] text-[clamp(13.5px,1.5vw,15.5px)] leading-relaxed text-slate-500">
            RF Health is operated by{" "}
            <strong className="font-semibold text-emerald-950">RAPDFLY PRIVATE LIMITED</strong>.
            This page explains how to request deletion of your RF Health account and the
            personal data linked to it, and what we have to keep by law.
          </p>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="mx-auto w-[min(92%,960px)] py-8 sm:py-10 lg:py-12">
        <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">

          <SectionCard id="how-to" icon={<Trash2 size={16} strokeWidth={1.5} />} title="How to request deletion">
            <ol className="mb-5 flex flex-col gap-3">
              {[
                <>Email <a href={MAIL_HREF} className="font-medium text-emerald-700 underline-offset-3 hover:underline">support@ppmsai.com</a> from the email address registered on your account, with the subject &quot;RF Health account deletion request&quot;.</>,
                <>Include your full name, your RF Health username, and the hospital or clinic you use RF Health with.</>,
                <>We confirm your identity and acknowledge the request within 7 business days.</>,
                <>We delete the account and the data described below, and email you when it is done, within 30 days of your request.</>,
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/[0.15]">
                    {i + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={MAIL_HREF}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-emerald-900"
              >
                <Mail size={15} strokeWidth={1.75} />
                Email a deletion request
              </a>
              <a
                href="tel:+917373351087"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-950/[0.12] transition-colors hover:bg-emerald-50"
              >
                <Phone size={15} strokeWidth={1.75} />
                +91 73733 51087
              </a>
            </div>
          </SectionCard>

          <SectionCard id="what-is-deleted" icon={<Database size={16} strokeWidth={1.5} />} title="What is deleted and what is kept">
            <SubHead>Deleted</SubHead>
            <ul className="mt-2 mb-4 flex flex-col gap-2">
              <Li>Your login: username, password and sign-in access to RF Health.</Li>
              <Li>Your profile details: name, email address, phone number and account settings.</Li>
            </ul>
            <SubHead>Kept, as required by law</SubHead>
            <ul className="mt-2 mb-4 flex flex-col gap-2">
              <Li>
                Patient medical records you created are clinical records of the hospital or
                practice. Indian law requires them to be retained for set periods, so they are
                kept even after your account is deleted. If you own the practice, you can ask for
                an export of these records before deletion.
              </Li>
              <Li>
                Audit logs of who viewed or changed a record are kept for as long as the law
                requires, and to resolve disputes or investigate security incidents.
              </Li>
            </ul>
            <P>
              Once the legal retention period ends, personal data that is no longer required is
              deleted or anonymised. See{" "}
              <a href="/privacy#retention" className="font-medium text-emerald-700 underline-offset-3 hover:underline">
                Data retention &amp; deletion
              </a>{" "}
              in our Privacy Policy for details.
            </P>
          </SectionCard>

        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-emerald-950/[0.07] bg-white">
        <div className="mx-auto w-[min(92%,1760px)] py-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[13px] text-slate-400">
          <p>© {new Date().getFullYear()} RAPDFLY PRIVATE LIMITED. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/" className="hover:text-emerald-800 transition-colors">Home</Link>
            <a href="/privacy" className="hover:text-emerald-800 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-emerald-800 transition-colors">Terms of Service</a>
            <a href="/refund" className="hover:text-emerald-800 transition-colors">Refund Policy</a>
            <CookieSettingsButton className="hover:text-emerald-800 transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
