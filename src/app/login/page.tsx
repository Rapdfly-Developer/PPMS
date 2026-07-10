import { redirect } from "next/navigation";
import { checkLicenseFromCookies, licenseRedirectTarget } from "@/lib/license-guard";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const license = await checkLicenseFromCookies();
  if (!license.allowLogin) {
    redirect(licenseRedirectTarget(license));
  }
  return <LoginClient />;
}
