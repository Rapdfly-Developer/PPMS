import type { Metadata } from "next";
import DrSaiLandingPage from "./DrSaiLandingPage";

export const metadata: Metadata = {
  title: "Dr. Sai | Vitreoretinal Surgeon & Ophthalmic Innovator",
  description:
    "Personal portfolio and clinical resume of Dr. Sai, Vitreoretinal Specialist (@vitreous_void). Precision ophthalmic surgery, micro-vascular diagnostics, and AI-assisted care.",
};

export default function DrSaiPage() {
  return <DrSaiLandingPage />;
}
