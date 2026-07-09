import { getLicenseData } from "./getLicenseData";
import { LicenseGatewayClient } from "./LicenseGatewayClient";

export const metadata = { title: "License — PPMS" };

export default async function LicensePage() {
  const data = await getLicenseData();
  return <LicenseGatewayClient initial={data} />;
}
