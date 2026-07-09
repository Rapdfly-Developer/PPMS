import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Playfair_Display, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { auth } from "@/auth";
import { roleHome } from "@/lib/rbac";
import { LandingClient } from "./LandingClient";

const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const jakarta  = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono2" });

export const metadata: Metadata = {
  title: "Dr. Sai | Vitreoretinal Surgeon & Ophthalmic Innovator (@vitreous_void)",
  description:
    "Personal portfolio and clinical resume of Dr. Sai, Vitreoretinal Specialist (@vitreous_void). Precision ophthalmic surgery, micro-vascular diagnostics, and AI-assisted care.",
};

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(roleHome((session.user as any).role));
  return (
    <div className={`${playfair.variable} ${jakarta.variable} ${spaceMono.variable}`}>
      <LandingClient />
    </div>
  );
}
