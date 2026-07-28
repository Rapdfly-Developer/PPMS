import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sora, Inter, Manrope } from "next/font/google";
import { auth } from "@/auth";
import { roleHome } from "@/lib/rbac";
import { SubPageClient } from "./sub_page/SubPageClient";

const sora    = Sora({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-sora" });
const inter   = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "PPMS — One Doctor. Multiple Hospitals. One Intelligent Platform.",
  description:
    "Manage appointments, EMR, prescriptions, billing, insurance, patient history and multiple hospitals from one secure cloud platform. Powered by RAPDFLY PRIVATE LIMITED.",
};

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(roleHome((session.user as any).role));
  return (
    <div className={`${sora.variable} ${inter.variable} ${manrope.variable}`}>
      <SubPageClient />
    </div>
  );
}
