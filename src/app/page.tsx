import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { auth } from "@/auth";
import { roleHome } from "@/lib/rbac";
import { PremiumLanding } from "@/components/landing/PremiumLanding";

/* Display grotesk for headlines, a softer grotesk for body. Both self-hosted by
   next/font, so there is no render-blocking request and no layout shift. */
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

const TITLE = "PPMS — One Doctor. Every Hospital. One Record.";
const DESCRIPTION =
  "Patient practice management for doctors working across multiple hospitals. Appointments, electronic medical records, prescriptions, surgery notes, billing and analytics in one secure account.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ppmsai.com"),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "patient practice management system",
    "multi-hospital doctor software",
    "electronic medical records India",
    "clinic management software",
    "EMR for doctors",
    "hospital appointment scheduling",
    "medical billing software",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://ppmsai.com",
    siteName: "PPMS",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/landing/v3/hero-clinician-tablet-dashboard.jpg",
        width: 736,
        height: 1318,
        alt: "A clinician reviewing a PPMS patient dashboard on a tablet",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/landing/v3/hero-clinician-tablet-dashboard.jpg"],
  },
  robots: { index: true, follow: true },
};

/* Product + FAQ structured data. The FAQ entries mirror the copy rendered in the
   accordion — if one changes, change both, or the markup misrepresents the page. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "PPMS",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      url: "https://ppmsai.com",
      publisher: { "@type": "Organization", name: "RAPDFLY PRIVATE LIMITED" },
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "0",
          priceCurrency: "INR",
          description: "30-day free trial",
        },
        {
          "@type": "Offer",
          name: "Professional",
          price: "2999",
          priceCurrency: "INR",
          description: "Per month",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          q: "Can one doctor really work across several hospitals in one account?",
          a: "Yes. You sign in once and switch hospitals from a single control, and the patient record travels with you. Each hospital keeps its own schedule, billing and staff roles, while the clinical history stays unified under the patient.",
        },
        {
          q: "What happens to our existing patient records?",
          a: "Records can be imported from spreadsheets or an existing system during onboarding. Paper records can be attached to a patient as a scanned document, and the text is extracted so it becomes searchable.",
        },
        {
          q: "Is the 30-day trial limited in any way?",
          a: "The trial gives one doctor account and up to two hospitals, with appointments, EMR and basic billing enabled. No card is required and nothing is charged when the trial ends.",
        },
        {
          q: "Who can see a patient's record?",
          a: "Access is role-based. Doctors, front desk, billing and administrators each see only the parts of a record their role requires, and every view and edit is written to an audit log.",
        },
      ].map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(roleHome((session.user as any).role));

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <PremiumLanding />
    </div>
  );
}
