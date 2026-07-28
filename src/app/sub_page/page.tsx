import type { Metadata } from "next";
import { Sora, Inter, Manrope } from "next/font/google";
import { SubPageClient } from "./SubPageClient";

const sora = Sora({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-sora" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "PPMS — One Doctor. Multiple Hospitals. One Intelligent Platform.",
  description:
    "Manage appointments, EMR, prescriptions, billing, insurance, patient history and multiple hospitals from one secure cloud platform. Powered by RAPDFLY PRIVATE LIMITED.",
};

export default function SubPage() {
  return (
    <div className={`${sora.variable} ${inter.variable} ${manrope.variable}`}>
      <SubPageClient />
    </div>
  );
}
