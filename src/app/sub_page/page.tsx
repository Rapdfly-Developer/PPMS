import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { SubPageClient } from "./SubPageClient";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-head",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-body-sp" });

export const metadata: Metadata = {
  title: "PPMS — The Future of Healthcare Practice Management | RAPDFLY",
  description:
    "One intelligent cloud platform to manage patients, appointments, EMR, billing and hospital operations. Built for doctors, clinics, hospitals and eye care centers by RAPDFLY PRIVATE LIMITED.",
};

export default function SubPage() {
  return (
    <div className={`${poppins.variable} ${inter.variable}`}>
      <SubPageClient />
    </div>
  );
}
