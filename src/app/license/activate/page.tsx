import { getActivationData } from "../getLicenseData";
import { ActivationClient } from "./ActivationClient";

export const metadata = { title: "License Activation — PPMS" };

export default async function LicenseActivatePage() {
  const data = await getActivationData();
  return <ActivationClient initial={data} />;
}
